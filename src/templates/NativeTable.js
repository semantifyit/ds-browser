const NativeTable = `
  <div class="row">
    <div class="col-12">
      <table id="native-table" class="table caption-top table-hover">
        <caption>
          link caption
        </caption>
        <thead>
          <tr class="table-dark">
            <th scope="col">Property</th>
            <th scope="col" class="text-center" style="width: 115px;">Cardinality</th>
            <th scope="col" class="text-center">Expected Type</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
         <tr>
            <th scope="row">name</th>
            <td class="text-center">1</td>
            <td class="text-center">Text</td>
            <td >The name of the item.</td>
          </tr>
          <tr>
            <th scope="row">description</th>
            <td class="text-center">0+</td>
            <td class="text-center">Text</td>
            <td >The description of the item.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

module.exports = NativeTable;
