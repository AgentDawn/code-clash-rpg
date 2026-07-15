const fs = require('fs');
const content = fs.readFileSync('public/app.js', 'utf8');

let newContent = content.replace(
  "const ul = document.getElementById('shop-items-list');",
  "const shopList = document.querySelector('.shop-item-list');\n  if (!shopList) return;\n  shopList.innerHTML = '';\n  const ul = shopList;"
);

newContent = newContent.replace(
  "li.className = 'shop-item';",
  "li.className = 'shop-item-card'; li.dataset.shopItem = item.id;"
);

newContent = newContent.replace(
  "const itemId = e.target.getAttribute('data-id');",
  "const itemId = e.target.getAttribute('data-item-id') || e.target.getAttribute('data-id');"
);

newContent = newContent.replace(
  /<button class="btn \${btnClass} buy-btn" data-id="\${item.id}" \${disableAttr}>/g,
  '<button class="rpg-btn btn-sm buy-btn" data-item-id="${item.id}" ${disableAttr}>'
);

fs.writeFileSync('public/app.js', newContent);
console.log('Fixed app.js');
