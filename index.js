const { chromium } = require('playwright');
const fetch = require('node-fetch');
// add db later
const {dbInsert, dbRemoveAll} = require('./database');

(async () => {
    await dbRemoveAll('books');
    const browser = await chromium.launch();
    await getBooksData(browser);    
    await browser.close();
})();

async function getBooksData(browser,stopPage = 1, startPage = 1) {
    if(startPage < 1 || stopPage < 1) {
        console.error("Start/stop page cannot be less than 1");
        return
    }
    let allbrowserContextPromises = [];
    for (let i = startPage - 1; i < stopPage; i++) {
        allbrowserContextPromises.push(browser.newContext());
    }
    return Promise.all(allbrowserContextPromises)
    .then((contexts) => {
        let pagePromises = [];
        for (let i = 0; i < contexts.length; i++) {
            pagePromises.push(contexts[i].newPage());
        }
        return Promise.all(pagePromises)
    })
    .then((pages) => {
        let allPagePromises = [];
        for (let i = 0; i < pages.length; i++) {
            allPagePromises.push(getReviewedBooksInOnePage(pages[i], startPage + i));
        }
        return Promise.all(allPagePromises)
    })
    .then((values)=> {
        values = values.reduce(((accumulator, currentValue) => accumulator.concat(currentValue)), []);
        console.log("Total books fetched:", values.length);
        return values;
    })
    .then(async (docs)=> {
        await dbInsert(docs, 'books');
    })
    .catch((error) => {
        console.error(error);
    });
}

async function getReviewedBooksInOnePage(pageObj, pageNumber) {
    let page = pageObj;
    let docs = [];
    let link = nextPageLink(pageNumber);
    await page.goto(link);
    let bookLinks = await page.$$('.story-card-news h3 a[href^="https://www.thehindu.com/books/books-reviews/"]');
    let booksDataOnOnePage = await parsePageLinks(bookLinks);
    docs = docs.concat(booksDataOnOnePage);
    return docs;
}

function nextPageLink(pageNumber) {
    let baseLink = "https://www.thehindu.com/books/books-reviews/";
    if(pageNumber > 1) {
        return baseLink + "?page=" + String(pageNumber);
    }
    return baseLink;
}

async function parsePageLinks(bookLinks) {
    let bookDataOnOnePage = [];
    for (let i = 0; i < bookLinks.length; i++) {
        let innerText = await bookLinks[i].innerText();
        
        let name = bookName(innerText);
        if(name) {
            let bookData = await booksApi(name);
            let cleanData = cleanUpGoogleBookData(bookData)
            bookDataOnOnePage.push(cleanData);
        }
    }
    return bookDataOnOnePage;
}

function bookName(string) {
    let regex = /‘(.)*’ review/g;
    let arr = regex.exec(string);
    let extract = arr? arr[0]: null;
    let replaceRegex = /‘|’|(review)|/g
    return extract? extract.replace(replaceRegex, ''): null;
}

async function booksApi(title) {
    let url = "https://www.googleapis.com/books/v1/volumes?q=" + title;
    let response = await fetch(url);
    let data = await response.json();
    // assuming that the first result in the array is accurate we return it
    return data.items[0].volumeInfo;
}

function cleanUpGoogleBookData(obj) {
    let data = {...obj};
    delete data.panelizationSummary;
    delete data.previewLink;
    delete data.infoLink;
    delete data.canonicalVolumeLink;
    delete data.allowAnonLogging;
    return data;
}