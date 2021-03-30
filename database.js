import arango from 'arangojs';
import env  from './config.js';

const Database = arango.Database;

// connect to database instance
const db = new Database({
    url: env.URL, 
    databaseName: env.DATABASENAME,
    auth: {username: env.USERNAME, password: env.PASSWORD}
});

export async function dbInsert(docs, collection) {
    let cursor = await db.query({
        query: `
        FOR book IN @docs
            INSERT book INTO @@collection
        `,
        bindVars: { 
            docs: docs,
            "@collection": collection 
        }
    });
}

export async function dbRemoveAll(collection) {
    await db.query({
        query: `
        FOR book IN @@collection
            REMOVE book IN @@collection
        `,
        bindVars: { 
            "@collection": collection 
        }
    });
}