import {chromium} from 'playwright';
import fetch from 'node-fetch';
import {dbInsert, dbRemoveAll} from './database.js';

(async (pagesToFetch=10) => {
    try {
        await dbRemoveAll('books');
        const browser = await chromium.launch();
        const context = await browser.newContext();
        let docs = [];
        let fetchedTillPage = 0;
        for (let i = 1; i + 5 <= pagesToFetch; i += 5) {
            let values = await getBooksData(context, i+5, i);
            docs = docs.concat(values);
            console.log(values.length);
            fetchedTillPage = i + 5;
        }
        if(fetchedTillPage < pagesToFetch) {
            let restOfTheValues = 
                await getBooksData(context, pagesToFetch + 1, fetchedTillPage == 0 ? 1: fetchedTillPage);
            docs = docs.concat(restOfTheValues);
        }
        console.log("Total books fetched:", docs.length);
        await dbInsert(docs, 'books');
        await browser.close();
    } catch (error) {
        console.error(error);
    }
})();

async function getBooksData(context, stopPage = 1, startPage = 1) {
    if(startPage < 1 || stopPage < 1) {
        console.error("Start/stop page cannot be less than 1");
        return
    } else if (stopPage < startPage) {
        console.error("Stop page cannot be less than Start page");
        return;
    }
    let allPagePromises = [];
    for (let i = startPage - 1; i < stopPage; i++) {
        let page = await context.newPage();
        allPagePromises.push(getReviewedBooksInOnePage(page, startPage + i));
    }
    return Promise.all(allPagePromises)
    .then((values)=> {
        values = values.reduce(((accumulator, currentValue) => accumulator.concat(currentValue)), []);
        return values;
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
    let regex = /???(.)*??? review/g;
    let arr = regex.exec(string);
    let extract = arr? arr[0]: null;
    let replaceRegex = /???|???|(review)|/g
    return extract? extract.replace(replaceRegex, ''): null;
}

async function booksApi(title) {
    let url = "https://www.googleapis.com/books/v1/volumes?q=" + title;
    let response = await fetch(encodeURI(url));
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