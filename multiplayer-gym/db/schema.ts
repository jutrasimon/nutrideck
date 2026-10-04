import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{id:text('id').primaryKey(),state:text('state').notNull(),version:integer('version').notNull().default(0),updatedAt:integer('updated_at').notNull()});
export const offCache=sqliteTable('off_cache',{id:text('id').primaryKey(),payload:text('payload').notNull(),expiresAt:integer('expires_at').notNull()});
