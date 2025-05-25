import { AtpAgent } from "@atproto/api";
import { IdResolver, MemoryCache } from "@atproto/identity";
import dotenv from "dotenv";

// Wrapper module for Bluesky
class Bsky {
  constructor({ identifier, password }) {
    this.identifier = identifier;
    this.password = password;
    this.idResolver = new IdResolver({
      plcUrl: "https://plc.directory",
      cache: new MemoryCache(),
      timeout: 3000,
    });
  }

  async getAgent() {
    if (!this._agent) {
      const agent = new AtpAgent({ service: "https://bsky.social" });
      await agent.login({
        identifier: this.identifier,
        password: this.password,
      });
      this._agent = agent.withProxy("bsky_chat", "did:web:api.bsky.chat");
    }
    return this._agent;
  }

  async listConvos() {
    const agent = await this.getAgent();
    const response = await agent.chat.bsky.convo.listConvos();
    return response.data.convos;
  }

  async getMessages(conversationId) {
    const agent = await this.getAgent();
    const response = await agent.chat.bsky.convo.getMessages({
      convoId: conversationId,
    });
    return response.data.messages;
  }

  async sendMessage(conversationId, message) {
    const agent = await this.getAgent();
    const response = await agent.chat.bsky.convo.sendMessage({
      convoId: conversationId,
      message: {
        text: message,
      },
    });
    return response;
  }

  async didToHandle(did) {
    const didDoc = await this.idResolver.did.resolve(did);
    return didDoc.alsoKnownAs
      .find((a) => a.startsWith("at://"))
      ?.split("at://")[1];
  }
}

// Main script

dotenv.config();

const { DID, PASSWORD } = process.env;

const bsky = new Bsky({
  identifier: DID,
  password: PASSWORD,
});

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getConversationMessages(convos) {
  const conversationMessages = [];
  for (const convo of convos) {
    const messages = (await bsky.getMessages(convo.id)).toSorted((a, b) => {
      return new Date(a.sentAt) - new Date(b.sentAt);
    });
    const user = convo.members.find((m) => m.did !== DID);
    conversationMessages.push({
      conversationId: convo.id,
      messages,
      user,
    });
  }
  return conversationMessages;
}

async function syncMessages(conversationMessages) {
  for (const conversationA of conversationMessages) {
    const userHandle = await bsky.didToHandle(conversationA.user.did);
    const userMessages = conversationA.messages.filter(
      (m) => m.sender.did !== DID
    );
    for (const conversationB of conversationMessages) {
      if (conversationA.user.did !== conversationB.user.did) {
        for (const message of userMessages) {
          const formattedMessage = `@${userHandle}: ${message.text}`;
          if (
            !conversationB.messages.some((m) => m.text === formattedMessage)
          ) {
            // Don't send the message if it's > 5 mins old, that means something went wrong
            if (
              new Date(message.sentAt) > new Date(Date.now() - 5 * 60 * 1000)
            ) {
              await bsky.sendMessage(
                conversationB.conversationId,
                formattedMessage
              );
              // add in-place to the conversationB messages to avoid duplicates
              conversationB.messages.push({
                text: formattedMessage,
              });
            }
          }
        }
      }
    }
  }
}

// 1. get messages
// 2. broadcast them to all the other users
async function run() {
  console.log("Getting convos");
  const convos = await bsky.listConvos();
  console.log("Getting latest messages");
  const conversationMessages = await getConversationMessages(convos);
  console.log("Syncing messages");
  await syncMessages(conversationMessages);
}

async function runLoop() {
  // Run the loop every 10 seconds, ignore errors
  while (true) {
    try {
      await run();
    } catch (e) {
      console.error(e);
    } finally {
      console.log("Waiting 10 seconds");
      await wait(10000);
    }
  }
}

async function main() {
  await runLoop();
}

main();
