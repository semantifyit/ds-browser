const navBarTemplate = require("../templates/NavigationBar.js");

class NavigationBarRenderer {
  constructor(browser) {
    this.b = browser;
    this.util = browser.util;
  }

  // returns the html frame for this element, which is required to be rendered in a later point of the process
  frame() {
    return `<div id="navbar-container"></div>`;
  }

  render() {
    const container = this.b.dsbContext.getElementById("navbar-container");

    // Edit button
    let editDsClass, editDsHref;
    if (this.b.editFunction) {
      editDsClass = "";
      editDsHref = "javascript:" + this.b.editFunction;
    } else {
      editDsClass = "d-none";
      editDsHref = "";
    }
    // List button
    let listName, listBtnClass, listBtnHref;
    if (this.b.listId) {
      listBtnClass = "";
      listBtnHref = "javascript:" + this.b.editFunction;
      if (this.b.list) {
        listName = this.b.list["schema:name"] || "List";
      }
    } else {
      listBtnClass = "d-none";
      listBtnHref = "";
    }
    let navBarHtml = navBarTemplate;
    navBarHtml = navBarHtml.replace(/{{editDsClass}}/g, editDsClass);
    navBarHtml = navBarHtml.replace(/{{editDsHref}}/g, editDsHref);
    navBarHtml = navBarHtml.replace(/{{listBtnClass}}/g, listBtnClass);
    navBarHtml = navBarHtml.replace(/{{listBtnHref}}/g, listBtnHref);
    navBarHtml = navBarHtml.replace(/{{listName}}/g, listName);
    container.innerHTML = navBarHtml;
  }
}

module.exports = NavigationBarRenderer;
