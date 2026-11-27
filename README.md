# Mercadona Basket Sync

**Version 6.3.0 · Chrome extension (Manifest V3)**

Mercadona Basket Sync transfers the products and quantities in your basket on the **new Mercadona online shop** to the **old Mercadona Telecompra website**. It also lets you save substitute product IDs for items that have different codes on the two websites.

> **Unofficial project:** This extension is not affiliated with, endorsed by, or maintained by Mercadona. Always check the old basket, prices and availability before placing an order.

## What it does

- Reads your basket from the new Mercadona website, including product quantities.
- Transfers products to the old Telecompra basket using their product IDs.
- Applies **saved substitutes** automatically when a product needs a different old-site ID.
- Shows a dashboard with product and unit counts for both baskets and saved substitute rules.
- Compares the requested products and quantities against the old basket.
- Highlights **products needing attention**, including products missing from the old basket and products identified as unavailable.
- Provides a **Find substitute** shortcut for problem products.
- Removes confirmed unavailable products **from the old basket only**; it does not remove them from your new Mercadona basket.
- Lets you export and import saved substitute mappings as JSON.

## Requirements

- Google Chrome or a compatible Chromium browser that supports Manifest V3 extensions.
- Access to both Mercadona websites, with your shopping/delivery location configured as required.
- The extension's files, downloaded from this repository or a release ZIP.

**Websites:**

- New shop: https://tienda.mercadona.es/
- Old Telecompra: https://telecompra.mercadona.es/ns/principal.php

## Install the extension

Until a Chrome Web Store release is available, install it manually:

1. Download the project ZIP and **extract** it to a permanent folder on your computer.
2. Open Chrome and enter `chrome://extensions` in the address bar.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the extracted folder containing `manifest.json`.
6. Pin **Mercadona Basket Sync** using Chrome's Extensions menu if you want quick access.

**Updating an unpacked installation:** Replace the files in the same extension folder, then click **Reload** at `chrome://extensions`. Avoid removing and reinstalling the extension unnecessarily, as this may discard locally saved substitute rules. Export your substitutes first as a backup.

## How to use it

1. Open the **new Mercadona** website and add the products you want to your basket. Adjust quantities there.
2. Open the **old Telecompra** website in another tab and wait until its basket/ticket is loaded. Log in and configure your delivery area if needed.
3. Click the **Mercadona Basket Sync** extension icon. Its dashboard should show both websites as accessible.
4. If you already know that a product requires a different code on the old site, create a substitute rule first (instructions below).
5. Click **Transfer basket**. The extension transfers the products and checks the results. Use **Stop** if you need to interrupt the transfer.
6. Click **Compare baskets** to check the old basket against the products and quantities requested on the new site.
7. Review **Products needing attention**. For a missing or unavailable product, click **Find substitute** to set up a replacement.
8. Check the old Mercadona basket and its prices manually **before checkout**.

Other controls:

- **Copy report:** Copies the transfer/comparison report so you can save or share it.
- **Clear log:** Clears the displayed report; it does not empty either shopping basket.
- **Open website:** Opens the corresponding Mercadona site from the dashboard.

## How substitute products work

Sometimes a product has a different ID on the new and old Mercadona websites, or the old site does not offer exactly the same product. A substitute rule tells the extension to use a particular **old-site product ID** whenever a chosen **new-site product ID** is in your basket.

For example:

| New-site product ID | Old-site product ID | Result |
| --- | --- | --- |
| `28060` | `27268` | When product `28060` is requested, transfer product `27268` instead. |

To create a substitute:

1. Expand **Substitutes** in the extension.
2. Under **Choose a substitute**, select the original product from your new basket.
3. Enter the **Old Mercadona ID** of the replacement product.
4. Optionally enter a descriptive **Label**, such as `8L Water`.
5. Click **Save substitute**.

You can also use **Or enter both product IDs manually** if you know both IDs. Use **Refresh basket** to reload the list of products available in the selector.

Saved substitute rules can be **edited**, **removed**, **searched**, **exported** and **imported**. They are stored locally by the extension and reused on later transfers. Importing rules with an existing new-site ID overwrites that particular mapping.

### Finding a product ID on the new Mercadona website

1. Go to https://tienda.mercadona.es/.
2. **Click the product** to open its product page.
3. Look at the browser's **address bar**. The product ID is the number immediately after `/product/` in the URL.
4. Copy that number as the **New site ID**.

For example, in this URL:

`https://tienda.mercadona.es/product/18836/salsa-fresca-cheddar-hacendado-tarrina`

the product ID is **`18836`** — the number immediately after `/product/` and before the product name. Copy only that number, not the entire URL.

### Finding a product ID on the old Mercadona website

1. Go to https://telecompra.mercadona.es/ns/principal.php.
2. Search for the product you want to use as the replacement.
3. Find its **Add to basket** button.
4. **Right-click the Add to basket button** and choose **Inspect** (or **Inspeccionar**).
5. Chrome Developer Tools opens and highlights the HTML associated with the button.
6. Look in the highlighted HTML or nearby attributes/code for the product entry. **The product ID appears immediately before the product name.**
7. Copy the numeric ID (without any surrounding text) and enter it as the **Old Mercadona ID** in the extension.

**Tip:** If Chrome highlights an image or nested element rather than the full button, inspect its surrounding parent element in the Elements panel. The old website uses legacy HTML and the precise markup may vary.

## Understanding the results

| Result | Meaning | What to do |
| --- | --- | --- |
| **Matched / Added** | The product and requested quantity were found in the old basket. | Check the product and price at checkout. |
| **Missing / Not visible** | The product could not be found in the visible old basket. | Use **Find substitute** or check manually on Telecompra. |
| **Unavailable** | The old website identified the product as unavailable. The extension removes that entry from the **old basket only**. | Choose a substitute if needed. |
| **Unverified** | The extension could not reliably confirm the product, for example after a basket reload timeout. | Compare baskets and inspect the old basket; do not assume it is unavailable. |

A product ID appearing in an old-site basket cookie **does not necessarily mean** the product is actually visible or orderable. The comparison feature checks the old basket rather than treating the cookie alone as proof of success.

## How it works (technical overview)

1. The extension reads the new site's cart data from its browser storage (`MO-cart`).
2. It gathers product IDs and quantities and retrieves product names where available.
3. It applies any saved new-ID → old-ID substitute rules.
4. It communicates with the old Telecompra page and updates its legacy basket (`cesta`) through the site's own cookie-handling mechanism.
5. It reloads/checks the old basket and records which items can be confirmed.
6. It checks for the old site's unavailable-product marker and removes those entries from the **old basket only**.
7. **Compare baskets** checks the requested products and quantities against the old basket's visible ticket.

The extension does **not** place orders or complete checkout. Existing quantities in the old basket are not intentionally reduced by the transfer; review any pre-existing items before placing an order.

## Troubleshooting

**The extension says a website is not accessible.** Open both Mercadona websites in Chrome tabs, wait for the pages to load, and make sure the old Telecompra basket/ticket is available. Then reopen the extension.

**A product is missing even though the transfer completed.** Run **Compare baskets**. The product may not be available on the old site, may have a different ID, or may not have loaded correctly. Use **Find substitute** to map it to a suitable old-site product.

**The product is listed as unverified.** This does not automatically mean it is unavailable. Check the visible basket and run the comparison again.

**A saved substitute is not applied.** Check that the new-site ID exactly matches the product in your new basket and that the old-site ID is correct. Refresh the basket selector if necessary.

**I am testing a first-time installation.** A separate Chrome profile is the cleanest test of a new installation because it does not share the extension's existing local substitute rules. Incognito browsing uses separate website cookies but may still share extension storage with your normal profile.

## Privacy and permissions

The extension requests Chrome permissions for tabs, scripting and local extension storage, plus access to the two Mercadona website domains. These permissions are used to locate the open shop tabs, read and update basket data, and save substitute rules and transfer status. The included extension code does not implement an external analytics or tracking service.

## Disclaimer

This is an independent, unofficial browser extension. Mercadona's website structure, product catalogue, prices and availability may change. The extension may stop working if either website changes. **Always verify products, quantities, substitutions, availability and prices on the old Mercadona website before ordering.**
