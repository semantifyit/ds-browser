const DSBrowserStyles = `/* Common */
.optional-property { color: #ffa517; }
.mandatory-property { color: #00ce0c; }

table.definition-table { border: 1px solid #98A0A6; width: 100%;}

.ds-selector {
    padding: 0 !important;
}
.ds-selector-tabs .selectors {
    border-bottom: 1px solid #98A0A6 !important;
}
.ds-selector-tabs .selectors a:first-child { margin-left: 0px; }

.ds-selector-tabs .selectors a.selected {
    border: 1px solid #98A0A6 !important;
}

#btn-row { padding: 12px 0px 12px 5px; }
.btn-vis { padding: 5px; }
.btn-vis-shadow {
    cursor: pointer;
    webkit-box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
    box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

/* Tree view */
#div-iframe { padding-right: 6px; }
#table-view, #iframe-jsTree {
     border-left: 1px solid #98A0A6;
     border-right: 1px solid  #98A0A6;
     border-bottom: 1px solid  #98A0A6;
}
#iframe-jsTree { padding: 2px; }

.jstree-grid-wrapper {
    display: inline-table !important;
}

/* New and used */

.navbar-nav .active {
    border-bottom: 2px solid rgba(0, 0, 0, 0.55);
}

#ds-browser-main-container {
    background-color: #f5f5f5;
}`;
module.exports = DSBrowserStyles;
