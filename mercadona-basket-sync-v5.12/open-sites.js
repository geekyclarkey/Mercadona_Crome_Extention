// Dashboard website shortcuts. Does not modify shopping baskets.
(() => {
  const sites = [
    ['openNewMercadona', 'https://tienda.mercadona.es/'],
    ['openOldMercadona', 'https://www.telecompra.mercadona.es/ns/principal.php']
  ];
  for (const [id, url] of sites) {
    document.getElementById(id)?.addEventListener('click', () => {
      chrome.tabs.create({ url, active: true });
    });
  }
})();
