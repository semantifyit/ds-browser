const DSTitleFrame = require("./DSTitleFrame.js");
const NativeTable = require("./NativeTable.js");
const NativeFrame = ` 
<div class="container-xl">
    ${DSTitleFrame}
    <div class="card my-3 rounded-3 shadow-3">
        <div class="card-body">
            <div class="card-text">
                <nav aria-label="breadcrumb">
                 
                    <ol class="breadcrumb">
                    <li class="breadcrumb-item"><i class="fas fa-code-branch"></i></li>
                        <li class="breadcrumb-item"><a href="#">PropertyValue</a></li>
                        <li class="breadcrumb-item"><a href="#">identifier</a></li>
                        <li class="breadcrumb-item active" aria-current="page">PropertyValue</li>
                    </ol>
                </nav>
            </div>
            ${NativeTable}
        </div>
    </div>
</div>
`;

module.exports = NativeFrame;
