const ListTableDsRow = require("../templates/ListTableDsRow.js");

class ListView {
  constructor(dsBrowser) {
    this.b = dsBrowser;
  }

  render() {
    // creates the html code for this view
    let listViewHtml = this.getFrame();

    // set html for navigationBar
    listViewHtml = listViewHtml.replace(
      /{{navigationBar}}/g,
      this.b.sharedFunctions.getNavigationBarHTML()
    );

    // set list title
    listViewHtml = listViewHtml.replace(
      /{{listTitleName}}/g,
      this.b.list["schema:name"] || "List"
    );

    // set list description
    listViewHtml = listViewHtml.replace(
      /{{listDescription}}/g,
      this.b.list["schema:description"] || "No List description available."
    );

    // set ds table body
    const tableBodyHtml =
      "<tbody>" +
      this.b.list["schema:hasPart"]
        .map((ds) => {
          return this.getDsRowHTML(ds);
        })
        .join("") +
      "</tbody>";
    listViewHtml = listViewHtml.replace(/{{tableBody}}/g, tableBodyHtml);

    // append the view to the DSB main container
    this.b.dsbContainer.innerHTML = listViewHtml;
  }

  // returns the base html code for this view
  getFrame() {
    return `<div id="list-view" class="noNav">
      <!--Page content-->
      <div class="container-xl">
        <!--Title-->
        <div class="row">
          <div class="col-12 mt-4 text-dark">
            <h2 class="mb-0">
              <span>{{listTitleName}}</span>
            </h2>
          </div>
          <div class="col-12 mb-3 mt-2">
             {{listDescription}}
          </div>
        </div>
        <!--Table for DS node Content  -->
        <table class="table bg-light rounded shadow-2">
           <thead>
              <tr class="bg-primary text-white align-middle">
                <th scope="col">Domain Specification</th>
                <th scope="col">Description</th>
              </tr>
           </thead>    
           {{tableBody}}
        </table>
      </div>
    </div>
`;
  }

  // returns the html for a ds row in the list table
  getDsRowHTML(ds) {
    // name as link
    const dsName = ds["schema:name"] || "DS with no name";
    const linkAttributes = this.b.util.createInternalLinkAttributes({
      dsId: ds["@id"].substring(ds["@id"].lastIndexOf("/") + 1),
    });
    const linkHtml = `<a class="a-js-link" ${linkAttributes} >${dsName}</a>`;
    // description
    const details = this.b.util.repairLinksInHTMLCode(ds["schema:description"]);

    return ListTableDsRow.replace(/{{ds}}/g, linkHtml).replace(
      /{{details}}/g,
      details
    );
  }
}

module.exports = ListView;
