require('dotenv').config();       
const express = require("express");
const http = require("http");
const cors = require("cors");
const amqp = require("amqplib"); 
const { Server } = require("socket.io");

const RABBIT_URL = process.env.RABBIT_URL;   // URL do broker RabbitMQ
const EXCHANGE   = process.env.EXCHANGE;     // nome do exchange (topic)
const QUEUE      = process.env.QUEUE;        // fila persistente

async function start() {
  // 1. Conexão com RabbitMQ
  const conn = await amqp.connect(RABBIT_URL);
  const channel = await conn.createChannel();

  // 2. Garante que o exchange existe (tipo topic, durável)
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });

  // 3. Garante que a fila persistente existe
  await channel.assertQueue(QUEUE, {
    durable: true,
    exclusive: false,
    autoDelete: false
  });

  // 4. Faz binding: tudo que começar com "pedidos." vai para a fila
  await channel.bindQueue(QUEUE, EXCHANGE, "pedidos.#");

  // 5. Configuração do servidor HTTP + WebSocket
  const app = express();
  app.use(cors());           // libera CORS
  app.use(express.json());   // habilita parse de JSON no body

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  // ===============================================================
  // Endpoint do produtor
  // ===============================================================
  app.post("/publicar", (req, res) => {
    const { nome, numero } = req.body || {};
    if (!nome || !numero) {
      return res.status(400).json({ error: "Dados obrigatórios!" });
    }

    // Routing key dinâmica: pedidos.<nome>
    const routingKey = `pedidos.${nome}`;
    const payload = { nome, numero };

    // Publica no exchange; mensagens persistentes ficam guardadas
    channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: "application/json" }
    );

    return res.json({ ok: true });
  });

  // ===============================================================
  // Consumo condicionado: só consome se houver clientes conectados
  // ===============================================================
  let connectedClients = 0;   // total de clientes WebSocket ativos
  let consumerTag = null;     // usado para parar o consumo depois

  // Inicia consumo da fila (se ainda não estiver ativo)
  async function startConsuming() {
    if (consumerTag) return; // já consumindo
    const { consumerTag: tag } = await channel.consume(
      QUEUE,
      (msg) => {
        if (!msg) return;
        const data = JSON.parse(msg.content.toString());

        // Envia a mensagem para todos os clientes conectados
        io.sockets.emit("pedidos", data);

        // Confirma a entrega para o RabbitMQ (remove da fila)
        channel.ack(msg);
      },
      { noAck: false }
    );
    consumerTag = tag;
    console.log("[RabbitMQ] Consumo iniciado");
  }

  // Para consumo (as mensagens ficam armazenadas na fila)
  async function stopConsuming() {
    if (!consumerTag) return;
    await channel.cancel(consumerTag);
    consumerTag = null;
    console.log("[RabbitMQ] Consumo parado (sem clientes conectados)");
  }

  // ===============================================================
  // Controle de conexões WebSocket
  // ===============================================================
  io.on("connection", (socket) => {
    connectedClients += 1;
    console.log(`[Socket] Cliente conectado (${connectedClients} ativo(s))`);

    // Se este for o primeiro cliente, inicia consumo
    if (connectedClients === 1) startConsuming();

    socket.on("disconnect", () => {
      connectedClients -= 1;
      console.log(`[Socket] Cliente desconectado (${connectedClients} ativo(s))`);

      // Se não há mais clientes, para o consumo
      if (connectedClients <= 0) stopConsuming();
    });
  });

  // ===============================================================
  // Inicialização do servidor HTTP
  // ===============================================================
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`[RabbitMQ] Exchange '${EXCHANGE}' | Queue '${QUEUE}'`);
  });
}

// Inicia o servidor
start().catch((err) => {
  console.error("Falha ao iniciar servidor:", err);
  process.exit(1);
});
