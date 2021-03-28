const arango = require('arangojs');
const {DATABASENAME, USERNAME, PASSWORD, URL} = require('./config');

const Database = arango.Database;
const aql = arango.aql;

// connect to database instance
const db = new Database({
    url: URL, 
    databaseName: DATABASENAME,
    auth: {username: USERNAME, password: PASSWORD}
});

async function dbInsert(docs, collection) {
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
    cursor.forEach(function (book) {
        console.log(book);
    });
}

module.exports = {
    dbInsert
};