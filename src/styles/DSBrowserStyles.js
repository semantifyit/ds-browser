const DSBrowserStyles = `/* Common */
.optional-property {
    color: #ffa517;
}

.mandatory-property {
    color: #00ce0c;
}

/* New and used */

#ds-browser-main-container {
    background-color: #f5f5f5;
    height: 100%;
}

#ds-browser-main-container > div.withNav {
    height: calc(100% - 60px);
    margin-top: 60px;
    overflow-y: scroll;
}

#ds-browser-main-container > div.noNav {
    height: 100%;
    overflow-y: scroll;
}`;
module.exports = DSBrowserStyles;
