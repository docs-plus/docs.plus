import * as Y from 'yjs'
import cryptoRandomString from 'crypto-random-string'

import { PrismaClient } from '@prisma/client'
import { generateJSON } from '@tiptap/html'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import { TiptapTransformer } from "@hocuspocus/transformer"
import { Database } from '@hocuspocus/extension-database'
import { SQLite } from '@hocuspocus/extension-sqlite'
import { Throttle } from '@hocuspocus/extension-throttle'
import { Redis } from '@hocuspocus/extension-redis'
import { Logger } from '@hocuspocus/extension-logger'

import { checkEnvBolean } from './utils/index.mjs'
const prisma = new PrismaClient()

const getServerName = () => `${ process.env.APP_NAME }_${ cryptoRandomString({ length: 4, type: 'alphanumeric' }) }`;

const generateDefaultState = () => {
  const html = `<h1>&shy;</h1>
  <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
  <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
  <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
  `;

  const json = generateJSON(html, [Document, Paragraph, Text, Bold]);

  const defaultDoc = TiptapTransformer.toYdoc(json);

  return Y.encodeStateAsUpdate(defaultDoc);
};

const configureExtensions = () => {
  const extensions = [];

  if (checkEnvBolean(process.env.HOCUSPOCUS_THROTTLE)) {
    extensions.push(new Throttle({
      throttle: +process.env.HOCUSPOCUS_THROTTLE_ATTEMPTS,
      banTime: +process.env.HOCUSPOCUS_THROTTLE_BANTIME
    }));
  }

  if (checkEnvBolean(process.env.HOCUSPOCUS_LOGGER)) {
    extensions.push(new Logger({
      onLoadDocument: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT),
      onChange: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_CHANGE),
      onConnect: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_CONNECT),
      onDisconnect: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_DISCONNECT),
      onUpgrade: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_UPGRADE),
      onRequest: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_REQUEST),
      onListen: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_LISTEN),
      onDestroy: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_DESTROY),
      onConfigure: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_CONFIGURE)

    }));
  }

  if (checkEnvBolean(process.env.REDIS)) {
    extensions.push(new Redis({
      host: process.env.REDIS_HOST,
      port: +process.env.REDIS_PORT
    }));
  }

  if (process.env.DATABASE_TYPE === 'SQLite') {
    extensions.push(new SQLite({ database: 'db.sqlite' }));
  }

  if (process.env.NODE_ENV === "production") {
    extensions.push(new Database({
      fetch: async ({ documentName, context }) => {
        try {
          const doc = await prisma.documents.findMany({
            take: 1,
            where: { documentId: documentName },
            orderBy: { id: 'desc' }
          });

          return doc[0]?.data || generateDefaultState();
        } catch (err) {
          console.error('Error fetching data:', err);
          await prisma.$disconnect();
          throw err;
        }
      },
      store: async ({ documentName, state, context }) => {
        try {
          return await prisma.documents.create({
            data: {
              documentId: documentName,
              data: state
            }
          });
        } catch (err) {
          console.error('Error storing data:', err);
          await prisma.$disconnect();
          throw err;
        }
      }
    }));
  }

  return extensions;
};

export default () => {
  return {
    name: getServerName(),
    port: process.env.HOCUSPOCUS_PORT,
    extensions: configureExtensions()
  }
};
