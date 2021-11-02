const DsTitle = `
  <div class="row">
    <div class="col-12 mt-3 text-dark">
      <h2 class="mb-0">
        <span>{{dsTitleName}}</span>
        <span><a id="ds-title-btn-edit" class="btn btn-floating btn-sm btn-primary ms-1 mb-1" href="#" role="button"><i class="fas fa-pen"></i></a></span>
      </h2>
    </div>
    <div class="col-12">
      <a id="ds-title-link-details" class="ms-1"
       data-mdb-toggle="collapse" href="#ds-title-details-container" role="button" aria-expanded="false" aria-controls="ds-title-details-container">details <i class="fas fa-caret-down"></i></a>
      <!-- Collapsed content -->
      <div class="collapse mt-1" id="ds-title-details-container">
        <div class="card">
          <div class="card-body p-2 ps-3">
            <table class="table table-sm">
              <tbody>
                <tr>
                  <td colspan="2">{{dsDescription}}</td>
                </tr>
                <tr>
                  <th style="width: 190px;">ID</th>
                  <td><a href="{{dsId}}" target="_blank">{{dsId}}</a></td>
                </tr>
                  <tr class="{{showSuperDs}}">
                  <th>Super-DS</th>
                <td><a href="{{dsSuperDs}}" target="_blank">{{dsSuperDs}}</a></td>
                </tr>
                <tr>
                  <th>Target Class(es)</th>
                  <td class="ps-2"><ul class="m-0">{{dsTargetClasses}}</ul></td>
                </tr>
                </tr>
                <tr>
                  <th>Schema.org version</th>
                  <td>{{dsSdoVersion}}</td>
                </tr>
                <tr class="{{showExternalVocabularies}}">
                  <th>External Vocabularies</th>
                  <td class="ps-2"><ul class="m-0">{{dsExternalVocabularies}}</ul></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
`;
module.exports = DsTitle;
