import {sql} from 'drizzle-orm';
import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const submissions=sqliteTable('submissions',{id:text('id').primaryKey(),playlistKey:text('playlist_key').notNull().unique(),playlistUrl:text('playlist_url').notNull(),title:text('title').notNull(),displayName:text('display_name').notNull().default(''),platform:text('platform').notNull().default(''),orderJson:text('order_json').notNull(),verifiedAt:text('verified_at').notNull()},t=>[index('submissions_page_idx').on(sql`${t.verifiedAt} DESC`,sql`${t.id} DESC`)]);
export const limits=sqliteTable('request_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()},t=>[index('request_limits_expiry_idx').on(t.expiresAt)]);

export const aggregateState=sqliteTable('aggregate_state',{id:integer('id').primaryKey(),total:integer('total').notNull().default(0),ready:integer('ready').notNull().default(0),positionsJson:text('positions_json').notNull().default('{}'),pairsJson:text('pairs_json').notNull().default('{}'),updatedAt:text('updated_at')});
export const aggregateSequences=sqliteTable('aggregate_sequences',{sequence:text('sequence').primaryKey(),count:integer('count').notNull().default(0)},t=>[index('aggregate_sequences_top_idx').on(sql`${t.count} DESC`,t.sequence)]);
