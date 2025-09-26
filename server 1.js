require('dotenv').config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const amqp = require("amqplib");
const { Server } = require("socket.io");

const RABBIT_URL = process.env.RABBIT_URL;
const EXCHANGE = process.env.EXCHANGE || 'pedidos';

(async function start() {
  const conn = await amqp.connect(RABBIT_URL);

  const pubCh = await conn.createChannel();
  await pubCh.assertExchange(EXCHANGE, "topic", { durable: true });

  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  const filasCriadas = new Set();

  // ---------------- PRODUTOR ----------------
  app.post("/publicar", async (req, res) => {
    try {
      const { nome, numero } = req.body || {};
      if (!nome || !numero) return res.status(400).json({ error: "Dados obrigatórios!" });

      const routingKey = "pedidos." + nome;
      const filaNome = "q.pedidos." + nome;

      // Se a fila ainda não foi criada, crie ela agora
      if (!filasCriadas.has(filaNome)) {
        // Cria a fila
        await pubCh.assertQueue(filaNome, { durable: true });
        // Associa a fila ao exchange
        await pubCh.bindQueue(filaNome, EXCHANGE, routingKey);
        filasCriadas.add(filaNome);  // Agora marque como criada
      }

      // Publica a mensagem no exchange
      const payload = Buffer.from(JSON.stringify({ nome, numero }));
      pubCh.publish(EXCHANGE, routingKey, payload, {
        persistent: true,
        contentType: "application/json"
      });

      return res.json({ ok: true });
    } catch (e) {
      console.error("Erro ao publicar:", e);
      return res.status(500).json({ error: "Falha ao publicar!" });
    }
  });

  // ---------------- CONSUMIDOR POR SOCKET ----------------
  io.on("connection", (socket) => {
    let ch, consumerTag, qname, boundKey;

    socket.on("subscribe", async (payload) => {
      try {
        // Aceita string ou objeto { nome }
        const raw = (typeof payload === "string" ? payload : payload?.nome || "").trim();
        if (!raw) return socket.emit("erro", "Informe um nome para assinar.");

        const nome = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
        qname = 'q.pedidos.' + nome;

        // Cria o canal e se inscreve na fila
        ch = await conn.createChannel();
        await ch.assertExchange(EXCHANGE, "topic", { durable: true });

        // Garantir que a fila exista
        await ch.assertQueue(qname, { durable: true });
        // Associação da fila com o exchange
        await ch.bindQueue(qname, EXCHANGE, "pedidos." + nome);

        // Consumir a fila e enviar dados via socket
        const consumer = await ch.consume(qname, (msg) => {
          if (!msg) return;
          const data = JSON.parse(msg.content.toString());
          socket.emit("pedidos", data);  // Emite os dados via socket
          ch.ack(msg);  // Confirma que a mensagem foi processada
        }, { noAck: false });

        consumerTag = consumer.consumerTag;

        // Desconectar quando o cliente se desconectar
        socket.on("disconnect", async () => {
          try {
            if (ch && consumerTag) await ch.cancel(consumerTag); // Cancelar o consumidor
            if (ch) await ch.close();  // Fechar o canal
          } catch (e) {
            console.warn("Erro ao limpar consumidor:", e);
          }
        });

      } catch (e) {
        console.error("subscribe erro:", e);
        socket.emit("erro", "Falha ao assinar o tópico.");
      }
    });

  });

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`HTTP: http://localhost:${PORT}`);
    console.log(`RabbitMQ exchange: ${EXCHANGE}`);
  });
})().catch((err) => {
  console.error("Falha ao iniciar servidor:", err);
  process.exit(1);
});