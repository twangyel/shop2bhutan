(function () {
  "use strict";

  var host = String(location.hostname || "").toLowerCase();
  var sourceUrl = String(location.href || "");

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\u200e|\u200f/g, "")
      .trim();
  }

  function absoluteUrl(value) {
    var raw = cleanText(value);
    if (!raw) return "";
    if (raw.indexOf("//") === 0) return "https:" + raw;

    try {
      return new URL(raw, location.href).href;
    } catch (_) {
      return "";
    }
  }

  function visible(node) {
    if (!node || !(node instanceof Element)) return false;

    var style = getComputedStyle(node);
    var rect = node.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) > 0 &&
      rect.width > 1 &&
      rect.height > 1
    );
  }

  function textFromNode(node) {
    if (!node) return "";

    return cleanText(
      node.getAttribute?.("content") ||
      node.getAttribute?.("value") ||
      node.textContent
    );
  }

  function firstNode(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var node = document.querySelector(selectors[i]);
      if (node) return node;
    }

    return null;
  }

  function firstText(selectors) {
    return textFromNode(firstNode(selectors));
  }

  var store = "other";

  if (
    host.indexOf("amazon.") >= 0 ||
    host.indexOf("amzn.") >= 0
  ) {
    store = "amazon";
  } else if (
    host.indexOf("flipkart.") >= 0 ||
    host.indexOf("fkrt.") >= 0
  ) {
    store = "flipkart";
  } else if (host.indexOf("myntra.") >= 0) {
    store = "myntra";
  } else if (host.indexOf("meesho.") >= 0) {
    store = "meesho";
  }

  function productPageKey(value) {
    var url;

    try {
      url = new URL(value, location.href);
    } catch (_) {
      return "";
    }

    var path = String(url.pathname || "").toLowerCase();
    var match;

    if (store === "amazon") {
      match = path.match(
        /\/(?:dp|gp\/product)\/([a-z0-9]{8,16})(?:[/?]|$)/i
      );

      if (!match) {
        match = path.match(
          /\/product\/([a-z0-9]{8,32})(?:[/?]|$)/i
        );
      }

      return match
        ? "amazon:" + match[1].toLowerCase()
        : "";
    }

    if (store === "flipkart") {
      var pid = cleanText(url.searchParams.get("pid"));
      if (pid) return "flipkart:" + pid.toLowerCase();

      match = path.match(/\/p\/(itm[a-z0-9]+)(?:[/?]|$)/i);
      return match
        ? "flipkart:" + match[1].toLowerCase()
        : "";
    }

    if (store === "myntra") {
      var segments = path
        .split("/")
        .filter(Boolean);

      for (var i = segments.length - 1; i >= 0; i -= 1) {
        if (/^\d{5,}$/.test(segments[i])) {
          return "myntra:" + segments[i];
        }
      }

      return "";
    }

    if (store === "meesho") {
      match = path.match(/\/p\/([a-z0-9_-]+)(?:[/?]|$)/i);

      if (!match) {
        match = path.match(
          /\/(?:s\/p|product)\/([a-z0-9_-]+)(?:[/?]|$)/i
        );
      }

      return match
        ? "meesho:" + match[1].toLowerCase()
        : "";
    }

    return "";
  }

  var pageKey = productPageKey(sourceUrl);

  var rawCanonical = absoluteUrl(
    document.querySelector('link[rel="canonical"]')?.href
  );

  var canonical =
    rawCanonical &&
    productPageKey(rawCanonical) === pageKey
      ? rawCanonical
      : sourceUrl;

  if (!pageKey) {
    return JSON.stringify({
      sourceUrl: sourceUrl,
      canonicalUrl: sourceUrl,
      store: store,
      title: "",
      image: "",
      displayedPrice: 0,
      currency: "INR",
      variant: "",
      captureMethod: "visible_page",
      confidence: 0,
      priceConfidence: 0,
      priceStatus: "missing",
      priceSource: "",
      priceAgreement: 0,
      priceReason: "Open a supported product page to detect its current selling price.",
      originalPrice: 0,
      priceDiagnostics: [],
      titleStable: false,
      priceStable: false,
      pageKey: "",
      capturedAt: Date.now()
    });
  }

  var rules = {
    amazon: {
      title: [
        "#productTitle",
        "#title_feature_div #productTitle",
        "[data-feature-name='title'] #productTitle",
        "[data-feature-name='title'] h1",
        "#title_feature_div h1",
        "h1#title",
        "h1.a-size-large"
      ],
      price: [
        "#corePrice_feature_div .priceToPay .a-offscreen",
        "#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen",
        "#apex_desktop .priceToPay .a-offscreen",
        "#apex_desktop .a-price:not(.a-text-price) .a-offscreen",
        "#priceblock_dealprice",
        "#priceblock_ourprice",
        "#price_inside_buybox",
        "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
        "#corePrice_desktop .a-price .a-offscreen",
        ".a-price.priceToPay .a-offscreen",
        ".a-price .a-price-whole"
      ],
      image: [
        "#landingImage",
        "#imgTagWrapperId img",
        "#main-image-container img"
      ],
      variant: [
        "#variation_color_name .selection",
        "#variation_size_name .selection",
        "#inline-twister-expanded-dimension-text-size_name",
        "#inline-twister-expanded-dimension-text-color_name"
      ]
    },

    flipkart: {
      title: [
        "h1 span.VU-ZEz",
        "h1 span.B_NuCI",
        "span.VU-ZEz",
        "span.B_NuCI",
        "main h1",
        "h1"
      ],
      price: [
        "div.Nx9bqj.CxhGGd",
        "div.Nx9bqj:not([class*='yRaY8j'])",
        "div._30jeq3:not(._3I9_wc)",
        "[itemprop='price']",
        "[class*='sellingPrice']",
        "[class*='SellingPrice']",
        "[data-testid*='price']"
      ],
      image: [
        "img.DByuf4",
        "img._396cs4",
        "[data-testid*='product-image'] img",
        "img[loading='eager']",
        "picture img"
      ],
      variant: [
        "[aria-selected='true']",
        "[class*='selected']"
      ]
    },

    myntra: {
      title: [
        ".pdp-name",
        ".pdp-title",
        "main h1",
        "h1"
      ],
      price: [
        ".pdp-price strong",
        ".pdp-discount-container .pdp-price strong",
        "[class*='pdp-price'] strong",
        "[itemprop='price']"
      ],
      image: [
        ".image-grid-image",
        ".image-grid-imageContainer img",
        "[class*='image-grid'] img",
        "picture img"
      ],
      variant: [
        ".size-buttons-size-button-default-selected",
        ".size-buttons-size-button-selected",
        "[class*='selectedSize']"
      ]
    },

    meesho: {
      title: [
        "[data-testid*='product-name']",
        "[data-testid*='product-title']",
        "[class*='ProductName']",
        "[class*='product-name']",
        "[class*='ProductTitle']",
        "[class*='product-title']",
        "main h1",
        "h1"
      ],
      price: [
        "[data-testid*='product-price']",
        "[data-testid*='price']",
        "[class*='ProductPrice']",
        "[class*='product-price']",
        "[class*='SellingPrice']",
        "[class*='selling-price']",
        "[itemprop='price']",
        "main h4",
        "main h5"
      ],
      image: [
        "[data-testid*='product-image'] img",
        "[class*='ProductImage'] img",
        "[class*='product-image'] img",
        "picture img",
        "main img"
      ],
      variant: [
        "[aria-selected='true']",
        "[class*='selected']"
      ]
    }
  };

  var rule = rules[store] || {
    title: ["main h1", "h1"],
    price: ["[itemprop='price']"],
    image: ["main img", "picture img"],
    variant: []
  };

  function cleanTitle(value) {
    var title = cleanText(value)
      .replace(/^amazon\.in\s*[:|-]\s*/i, "")
      .replace(
        /\s*[|:-]\s*(Amazon\.in|Flipkart|Myntra|Meesho).*$/i,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

    if (title.length > 280) {
      title = title.slice(0, 280).trim();
    }

    return title;
  }

  function usefulTitle(value) {
    var title = cleanTitle(value);

    return (
      title.length >= 5 &&
      !/^(amazon(?:\.in)?|flipkart|myntra|meesho|online shopping|shopping|home)$/i.test(
        title
      ) &&
      !/^(visit the|shop the|brand:)\b/i.test(title)
    );
  }

  function findBestProductJson() {
    var scripts = Array.from(
      document.querySelectorAll(
        'script[type="application/ld+json"], script#__NEXT_DATA__, script[type="application/json"]'
      )
    ).slice(0, 35);

    var best = null;
    var bestScore = 0;
    var visited = 0;

    function scoreObject(value) {
      if (!value || typeof value !== "object") return 0;

      var type = value["@type"] || value.type;
      var typeText = Array.isArray(type)
        ? type.join(" ")
        : String(type || "");

      var name =
        value.name ||
        value.title ||
        value.productName ||
        value.product_name;

      var image =
        value.image ||
        value.images ||
        value.imageUrl ||
        value.image_url ||
        value.thumbnailUrl;

      var price =
        value.offers ||
        value.offer ||
        value.price ||
        value.salePrice ||
        value.sellingPrice ||
        value.selling_price ||
        value.discountedPrice ||
        value.discounted_price ||
        value.productPrice ||
        value.product_price;

      var score = 0;
      if (/(^|\s)product(\s|$)/i.test(typeText)) score += 80;
      if (name) score += 35;
      if (image) score += 25;
      if (price) score += 35;
      if (value.sku || value.productId || value.product_id) score += 15;

      return score;
    }

    function walk(value, depth, seen) {
      if (!value || depth > 11 || visited > 6500) return;

      if (typeof value === "object") {
        if (seen.indexOf(value) >= 0) return;
        seen.push(value);
        visited += 1;
      }

      if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i += 1) {
          walk(value[i], depth + 1, seen);
        }
        return;
      }

      if (typeof value !== "object") return;

      var score = scoreObject(value);
      if (score > bestScore) {
        best = value;
        bestScore = score;
      }

      var keys = Object.keys(value);
      for (var k = 0; k < keys.length; k += 1) {
        var key = keys[k];

        if (
          /review|breadcrumb|seller|organization|aggregateRating|analytics|tracking/i.test(
            key
          )
        ) {
          continue;
        }

        walk(value[key], depth + 1, seen);
      }
    }

    for (var i = 0; i < scripts.length; i += 1) {
      var text = cleanText(scripts[i].textContent);
      if (!text || text.length > 5000000) continue;

      try {
        walk(JSON.parse(text), 0, []);
      } catch (_) {}
    }

    return bestScore >= 60 ? best : null;
  }

  function valueFromObject(value, keys) {
    if (!value || typeof value !== "object") return "";

    for (var i = 0; i < keys.length; i += 1) {
      var candidate = value[keys[i]];

      if (
        candidate !== undefined &&
        candidate !== null &&
        candidate !== ""
      ) {
        return candidate;
      }
    }

    return "";
  }

  function jsonTitle(product) {
    return cleanTitle(
      valueFromObject(product, [
        "name",
        "title",
        "productName",
        "product_name"
      ])
    );
  }

  function normalizePriceNumber(value) {
    var number = Number(value);

    if (
      !Number.isFinite(number) ||
      number <= 0 ||
      number >= 100000000
    ) {
      return 0;
    }

    return Math.round(number * 100) / 100;
  }

  function parsePlainPrice(value) {
    if (typeof value === "number") {
      return normalizePriceNumber(value);
    }

    var raw = cleanText(value)
      .replace(/\u00a0/g, " ")
      .replace(/,/g, "");

    if (!raw) return 0;

    var match = raw.match(/\d+(?:\.\d{1,2})?/);
    if (!match) return 0;

    return normalizePriceNumber(match[0]);
  }

  function currencyPrices(value) {
    var raw = cleanText(value)
      .replace(/\u00a0/g, " ");
    var matches = [];
    var expression = /(?:₹|INR|Rs\.?|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi;
    var match;

    while ((match = expression.exec(raw)) !== null) {
      var number = normalizePriceNumber(
        match[1].replace(/,/g, "")
      );

      if (number > 0) matches.push(number);
    }

    return matches;
  }

  function priceValuesFromUnknown(value, depth) {
    var level = Number(depth || 0);
    if (level > 5 || value === null || value === undefined) {
      return [];
    }

    if (typeof value === "number" || typeof value === "string") {
      var direct = parsePlainPrice(value);
      return direct > 0 ? [direct] : [];
    }

    if (Array.isArray(value)) {
      var flattened = [];

      for (var i = 0; i < value.length; i += 1) {
        flattened = flattened.concat(
          priceValuesFromUnknown(value[i], level + 1)
        );
      }

      return flattened;
    }

    if (typeof value !== "object") return [];

    var preferredKeys = [
      "price",
      "salePrice",
      "sale_price",
      "sellingPrice",
      "selling_price",
      "discountedPrice",
      "discounted_price",
      "finalPrice",
      "final_price",
      "offerPrice",
      "offer_price",
      "currentPrice",
      "current_price",
      "amount",
      "value"
    ];
    var result = [];

    for (var k = 0; k < preferredKeys.length; k += 1) {
      var key = preferredKeys[k];
      if (value[key] === undefined || value[key] === null) continue;

      result = result.concat(
        priceValuesFromUnknown(value[key], level + 1)
      );
    }

    return result;
  }

  function jsonPriceCandidates(product) {
    if (!product) return [];

    var candidates = [];
    var offers = product.offers || product.offer || [];
    var offerList = Array.isArray(offers)
      ? offers
      : [offers];

    for (var i = 0; i < offerList.length; i += 1) {
      var offer = offerList[i] || {};
      var availability = cleanText(
        offer.availability || offer.itemAvailability
      ).toLowerCase();

      if (/outofstock|soldout|discontinued/.test(availability)) {
        continue;
      }

      candidates = candidates.concat(
        priceValuesFromUnknown(offer, 0)
      );
    }

    candidates = candidates.concat(
      priceValuesFromUnknown(product, 0)
    );

    var unique = [];

    for (var p = 0; p < candidates.length; p += 1) {
      var value = normalizePriceNumber(candidates[p]);

      if (
        value > 0 &&
        !unique.some(function (existing) {
          return Math.abs(existing - value) < 0.01;
        })
      ) {
        unique.push(value);
      }
    }

    return unique.slice(0, 8);
  }

  function jsonPrice(product) {
    var prices = jsonPriceCandidates(product);
    return prices.length ? prices[0] : 0;
  }

  function jsonImage(product) {
    if (!product) return "";

    var value = valueFromObject(product, [
      "image",
      "images",
      "imageUrl",
      "image_url",
      "thumbnailUrl",
      "productImage",
      "product_image"
    ]);

    if (Array.isArray(value)) value = value[0];

    if (value && typeof value === "object") {
      value =
        value.url ||
        value.contentUrl ||
        value.src ||
        value.original ||
        value.large;
    }

    return absoluteUrl(value);
  }

  function selectorTitleCandidate() {
    if (store === "myntra") {
      var brand = cleanTitle(firstText([".pdp-title"]));
      var name = cleanTitle(firstText([".pdp-name"]));

      if (
        usefulTitle(brand) &&
        usefulTitle(name) &&
        brand.toLowerCase() !== name.toLowerCase()
      ) {
        return {
          value: cleanTitle(brand + " " + name),
          source: "myntra_selector",
          confidence: 98,
          node: firstNode([".pdp-name", ".pdp-title"])
        };
      }
    }

    for (var i = 0; i < rule.title.length; i += 1) {
      var node = document.querySelector(rule.title[i]);
      var value = cleanTitle(textFromNode(node));

      if (usefulTitle(value)) {
        return {
          value: value,
          source: store + "_selector",
          confidence: Math.max(82, 98 - i * 3),
          node: node
        };
      }
    }

    return {
      value: "",
      source: "",
      confidence: 0,
      node: null
    };
  }

  function bestTitleCandidate(product) {
    var candidates = [];
    var selector = selectorTitleCandidate();

    if (selector.value) candidates.push(selector);

    var structured = jsonTitle(product);
    if (usefulTitle(structured)) {
      candidates.push({
        value: structured,
        source: "json_ld",
        confidence: 88,
        node: null
      });
    }

    var openGraph = cleanTitle(firstText([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]'
    ]));

    if (usefulTitle(openGraph)) {
      candidates.push({
        value: openGraph,
        source: "open_graph",
        confidence: 76,
        node: null
      });
    }

    var documentTitle = cleanTitle(document.title);
    if (usefulTitle(documentTitle)) {
      candidates.push({
        value: documentTitle,
        source: "document_title",
        confidence: 55,
        node: null
      });
    }

    candidates.sort(function (left, right) {
      return right.confidence - left.confidence;
    });

    return candidates[0] || {
      value: "",
      source: "",
      confidence: 0,
      node: null
    };
  }

  function structuralContext(node) {
    if (!node) return "";

    var values = [];
    var current = node;

    for (var depth = 0; depth < 4 && current; depth += 1) {
      values.push(
        current.id,
        current.className,
        current.getAttribute?.("aria-label"),
        current.getAttribute?.("data-testid"),
        current.getAttribute?.("itemprop"),
        current.getAttribute?.("role")
      );
      current = current.parentElement;
    }

    return cleanText(values.join(" ")).toLowerCase();
  }

  function compactNodeText(node, maxLength) {
    if (!node) return "";

    var text = cleanText(node.textContent).toLowerCase();
    var limit = Number(maxLength || 220);

    return text.length <= limit
      ? text
      : text.slice(0, limit);
  }

  function nearestInlineContext(node) {
    if (!node) return "";

    var parts = [
      compactNodeText(node, 120),
      compactNodeText(node.previousElementSibling, 90),
      compactNodeText(node.nextElementSibling, 90)
    ];

    var parent = node.parentElement;
    if (parent && parent.children.length <= 6) {
      parts.push(compactNodeText(parent, 220));
    }

    return cleanText(parts.join(" ")).toLowerCase();
  }

  function negativePriceContext(value) {
    return /\b(?:emi|per\s*month|\/\s*month|monthly|coupon|cashback|bank\s*offer|exchange\s*offer|delivery\s*(?:fee|charge)|shipping\s*(?:fee|charge)|convenience\s*fee|handling\s*fee|installation\s*charge|effective\s*price|with\s*offer|after\s*coupon|save\s*₹|you\s*save)\b/i.test(
      cleanText(value)
    );
  }

  function originalPriceContext(value) {
    return /\b(?:mrp|maximum\s*retail\s*price|original\s*price|list\s*price|old\s*price|was\s*₹|strike(?:d|through)?|a-text-price)\b/i.test(
      cleanText(value)
    );
  }

  function recommendationContext(value) {
    return /\b(?:recommended|recommendation|similar\s*products?|customers?\s*also|you\s*might\s*like|sponsored|recently\s*viewed|more\s*items?|related\s*products?|frequently\s*bought|carousel|search\s*result|listing|grid\s*item)\b/i.test(
      cleanText(value)
    );
  }

  function rejectedPriceNode(node) {
    if (!node || !visible(node)) return true;

    if (node.closest("del, s, strike")) return true;

    var style = getComputedStyle(node);
    if (/line-through/i.test(style.textDecorationLine || "")) {
      return true;
    }

    var structural = structuralContext(node);
    var ownText = compactNodeText(node, 150);
    var inline = nearestInlineContext(node);

    if (
      originalPriceContext(structural) ||
      originalPriceContext(ownText)
    ) {
      return true;
    }

    if (
      negativePriceContext(structural) ||
      negativePriceContext(ownText)
    ) {
      return true;
    }

    // Reject a tiny, self-contained EMI/offer row, but do not reject the
    // main selling-price container merely because the same parent also
    // contains an MRP or discount label.
    if (
      node.parentElement?.children.length <= 3 &&
      inline.length <= 180 &&
      negativePriceContext(inline)
    ) {
      return true;
    }

    return false;
  }

  function amazonSplitPrice(node) {
    if (!node || store !== "amazon") return 0;

    if (!/(?:a-price-whole|price-whole)/i.test(String(node.className || ""))) {
      return 0;
    }

    var whole = cleanText(node.textContent).replace(/[^\d]/g, "");
    var fractionNode =
      node.parentElement?.querySelector(".a-price-fraction") ||
      node.nextElementSibling;
    var fraction = cleanText(fractionNode?.textContent).replace(/[^\d]/g, "");

    if (!whole) return 0;

    return normalizePriceNumber(
      whole + (fraction ? "." + fraction.slice(0, 2) : "")
    );
  }

  function priceNodeValues(node) {
    var raw =
      node.getAttribute?.("content") ||
      node.getAttribute?.("value") ||
      node.textContent;

    var values = currencyPrices(raw);
    var splitAmazon = amazonSplitPrice(node);

    if (splitAmazon > 0) values.unshift(splitAmazon);

    if (
      !values.length &&
      (
        node.hasAttribute?.("content") ||
        node.hasAttribute?.("itemprop") ||
        /price/i.test(structuralContext(node))
      )
    ) {
      var plain = parsePlainPrice(raw);
      if (plain > 0) values.push(plain);
    }

    var unique = [];

    for (var i = 0; i < values.length; i += 1) {
      var value = normalizePriceNumber(values[i]);

      if (
        value > 0 &&
        !unique.some(function (existing) {
          return Math.abs(existing - value) < 0.01;
        })
      ) {
        unique.push(value);
      }
    }

    return unique;
  }

  function productRootSelectors() {
    if (store === "amazon") {
      return ["#dp-container", "#ppd", "#centerCol", "#detailBulletsWrapper_feature_div"];
    }

    if (store === "flipkart") {
      return ["main", "[data-testid*='product']", "[class*='product-page']", "[class*='ProductPage']"];
    }

    if (store === "myntra") {
      return [".pdp-details", ".pdp-description-container", "main"];
    }

    if (store === "meesho") {
      return ["main", "[data-testid*='product']", "[class*='ProductDetails']", "[class*='product-details']"];
    }

    return ["main"];
  }

  function actionNodes() {
    var selectors = [
      "#add-to-cart-button",
      "#buy-now-button",
      "input[name='submit.add-to-cart']",
      "[data-testid*='add-to-cart']",
      "[data-testid*='buy-now']",
      "[class*='add-to-bag']",
      "[class*='AddToBag']",
      "[class*='addToCart']",
      "[class*='buyNow']"
    ];
    var nodes = [];

    for (var i = 0; i < selectors.length; i += 1) {
      var selected = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < selected.length; j += 1) {
        if (visible(selected[j])) nodes.push(selected[j]);
      }
    }

    var buttons = document.querySelectorAll("button, input[type='submit'], [role='button']");
    var limit = Math.min(buttons.length, 250);

    for (var b = 0; b < limit; b += 1) {
      var button = buttons[b];
      var text = cleanText(
        button.getAttribute?.("value") ||
        button.getAttribute?.("aria-label") ||
        button.textContent
      ).toLowerCase();

      if (
        visible(button) &&
        /\b(?:add\s*to\s*(?:cart|bag)|buy\s*now|add\s*to\s*basket)\b/.test(text)
      ) {
        nodes.push(button);
      }
    }

    return nodes.slice(0, 20);
  }

  function nearestRectDistance(first, second) {
    if (!first || !second) return 100000;

    var a = first.getBoundingClientRect();
    var b = second.getBoundingClientRect();
    var horizontal = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
    var vertical = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));

    return Math.sqrt(horizontal * horizontal + vertical * vertical);
  }

  function insideProductRoot(node) {
    var selectors = productRootSelectors();

    for (var i = 0; i < selectors.length; i += 1) {
      var root = node.closest?.(selectors[i]);
      if (root && visible(root)) return true;
    }

    return false;
  }

  function priceCandidateScore(
    node,
    base,
    valueIndex,
    titleNode,
    actions
  ) {
    var style = getComputedStyle(node);
    var rect = node.getBoundingClientRect();
    var fontSize = Number.parseFloat(style.fontSize || "0") || 0;
    var fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
    var score =
      base +
      Math.min(120, fontSize * 4) +
      (fontWeight >= 600 ? 22 : 0) -
      valueIndex * 24;

    var context = structuralContext(node);
    var inline = nearestInlineContext(node);

    if (
      /selling|sale.?price|current|final|payable|price.?to.?pay|product.?price|discounted.?price|offer.?price/.test(
        context
      )
    ) {
      score += 75;
    } else if (/price/.test(context)) {
      score += 35;
    }

    if (/deal\s*price|special\s*price|now\s*₹/.test(inline)) {
      score += 35;
    }

    if (insideProductRoot(node)) score += 65;

    if (titleNode && visible(titleNode)) {
      var titleRect = titleNode.getBoundingClientRect();
      var distance = Math.abs(rect.top - titleRect.bottom);

      score += Math.max(0, 155 - distance / 2.5);

      if (rect.top < titleRect.top - 180) {
        score -= 110;
      }
    }

    var nearestAction = 100000;

    for (var a = 0; a < actions.length; a += 1) {
      nearestAction = Math.min(
        nearestAction,
        nearestRectDistance(node, actions[a])
      );
    }

    if (nearestAction < 250) {
      score += 95;
    } else if (nearestAction < 600) {
      score += 55;
    } else if (nearestAction < 1000) {
      score += 20;
    }

    if (
      rect.top >= -120 &&
      rect.top <= window.innerHeight * 1.6
    ) {
      score += 35;
    } else if (rect.top > window.innerHeight * 3) {
      score -= 70;
    }

    if (recommendationContext(context) || recommendationContext(inline)) {
      score -= 180;
    }

    if (
      node.closest("header, footer, nav, aside") ||
      /header|footer|navbar|drawer|menu/.test(context)
    ) {
      score -= 120;
    }

    return score;
  }

  function selectorPriceCandidates(titleNode, actions) {
    var candidates = [];

    for (var i = 0; i < rule.price.length; i += 1) {
      var nodes = document.querySelectorAll(rule.price[i]);

      for (var j = 0; j < nodes.length; j += 1) {
        var node = nodes[j];
        if (rejectedPriceNode(node)) continue;

        var values = priceNodeValues(node);

        for (var v = 0; v < values.length; v += 1) {
          candidates.push({
            value: values[v],
            source: store + "_selector",
            sourceGroup: "selector",
            confidence: Math.max(76, 99 - i * 3),
            score: priceCandidateScore(
              node,
              720 - i * 26,
              v,
              titleNode,
              actions
            ),
            node: node,
            evidence: rule.price[i]
          });
        }
      }
    }

    return candidates;
  }

  function metadataPriceCandidates() {
    var selectors = [
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      'meta[itemprop="price"]',
      '[itemprop="offers"] [itemprop="price"]',
      '[itemprop="price"][content]'
    ];
    var candidates = [];

    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j += 1) {
        var value = parsePlainPrice(
          nodes[j].getAttribute?.("content") ||
          nodes[j].getAttribute?.("value") ||
          nodes[j].textContent
        );

        if (value > 0) {
          candidates.push({
            value: value,
            source: "metadata",
            sourceGroup: "metadata",
            confidence: Math.max(74, 92 - i * 4),
            score: 520 - i * 20,
            node: nodes[j],
            evidence: selectors[i]
          });
        }
      }
    }

    return candidates;
  }

  function genericPriceCandidates(titleNode, actions) {
    var nodes = document.querySelectorAll("body *");
    var limit = Math.min(nodes.length, 4800);
    var candidates = [];

    for (var i = 0; i < limit; i += 1) {
      var node = nodes[i];

      if (
        rejectedPriceNode(node) ||
        node.children.length > 2
      ) {
        continue;
      }

      var text = cleanText(node.textContent);

      if (
        !text ||
        text.length > 110 ||
        !/(₹|INR|Rs\.?|रु\.?)/i.test(text)
      ) {
        continue;
      }

      var values = priceNodeValues(node);

      for (var v = 0; v < values.length; v += 1) {
        candidates.push({
          value: values[v],
          source: "visible_page",
          sourceGroup: "visible",
          confidence: 64,
          score: priceCandidateScore(
            node,
            310,
            v,
            titleNode,
            actions
          ),
          node: node,
          evidence: structuralContext(node).slice(0, 140)
        });
      }
    }

    return candidates;
  }

  function originalPriceCandidate(currentPrice) {
    if (!(currentPrice > 0)) return 0;

    var selectors = [
      "del",
      "s",
      "strike",
      ".a-text-price .a-offscreen",
      ".pdp-mrp",
      "[class*='mrp']",
      "[class*='MRP']",
      "[class*='originalPrice']",
      "[class*='OriginalPrice']",
      "[class*='listPrice']"
    ];
    var best = 0;

    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j += 1) {
        if (!visible(nodes[j])) continue;

        var values = priceNodeValues(nodes[j]);

        for (var v = 0; v < values.length; v += 1) {
          var value = values[v];

          if (
            value > currentPrice &&
            (best === 0 || value < best)
          ) {
            best = value;
          }
        }
      }
    }

    return best;
  }

  function samePrice(left, right) {
    var a = Number(left || 0);
    var b = Number(right || 0);
    var tolerance = Math.max(0.5, Math.max(a, b) * 0.0025);

    return Math.abs(a - b) <= tolerance;
  }

  function aggregatePriceCandidates(candidates) {
    var groups = [];

    candidates
      .filter(function (candidate) {
        return candidate.value > 0 && candidate.score > 0;
      })
      .sort(function (left, right) {
        return right.score - left.score;
      })
      .forEach(function (candidate) {
        var group = groups.find(function (existing) {
          return samePrice(existing.value, candidate.value);
        });

        if (!group) {
          group = {
            value: candidate.value,
            candidates: [],
            sourceGroups: {},
            sources: {},
            bestScore: candidate.score,
            bestConfidence: candidate.confidence
          };
          groups.push(group);
        }

        group.candidates.push(candidate);
        group.sourceGroups[candidate.sourceGroup || candidate.source] = true;
        group.sources[candidate.source] = true;
        group.bestScore = Math.max(group.bestScore, candidate.score);
        group.bestConfidence = Math.max(
          group.bestConfidence,
          candidate.confidence
        );
      });

    for (var i = 0; i < groups.length; i += 1) {
      var group = groups[i];
      var support = group.candidates.length;
      var sourceAgreement = Object.keys(group.sourceGroups).length;
      var selectorSupport = Boolean(group.sourceGroups.selector);
      var visibleSupport = Boolean(group.sourceGroups.visible);
      var structuredSupport = Boolean(
        group.sourceGroups.metadata ||
        group.sourceGroups.json_ld
      );

      group.agreement = sourceAgreement;
      group.score =
        group.bestScore +
        Math.min(150, (support - 1) * 34) +
        Math.min(110, (sourceAgreement - 1) * 48) +
        (selectorSupport && structuredSupport ? 75 : 0) +
        (visibleSupport && structuredSupport ? 45 : 0);

      group.confidence = Math.min(
        99,
        group.bestConfidence +
        Math.min(18, (support - 1) * 4) +
        Math.min(14, (sourceAgreement - 1) * 7) +
        (selectorSupport && structuredSupport ? 7 : 0)
      );

      group.best = group.candidates.sort(function (left, right) {
        return right.score - left.score;
      })[0];
    }

    groups.sort(function (left, right) {
      return right.score - left.score;
    });

    return groups;
  }

  function bestPriceCandidate(product, titleNode) {
    var actions = actionNodes();
    var candidates = selectorPriceCandidates(titleNode, actions);

    candidates = candidates.concat(metadataPriceCandidates());

    var structuredPrices = jsonPriceCandidates(product);

    for (var s = 0; s < structuredPrices.length; s += 1) {
      candidates.push({
        value: structuredPrices[s],
        source: "json_ld",
        sourceGroup: "json_ld",
        confidence: Math.max(70, 88 - s * 4),
        score: 490 - s * 24,
        node: null,
        evidence: "Product/Offer structured data"
      });
    }

    candidates = candidates.concat(
      genericPriceCandidates(titleNode, actions)
    );

    var groups = aggregatePriceCandidates(candidates);
    var best = groups[0];
    var second = groups[1];

    if (!best) {
      return {
        value: 0,
        source: "",
        confidence: 0,
        score: 0,
        agreement: 0,
        status: "missing",
        reason: "No reliable current selling price was found.",
        originalPrice: 0,
        diagnostics: []
      };
    }

    var conflict = Boolean(
      second &&
      !samePrice(best.value, second.value) &&
      second.score >= best.score - 85
    );
    var selectorBacked = Boolean(best.sourceGroups.selector);
    var structuredBacked = Boolean(
      best.sourceGroups.metadata ||
      best.sourceGroups.json_ld
    );
    var high =
      !conflict &&
      (
        (selectorBacked && best.confidence >= 86) ||
        (best.agreement >= 2 && best.confidence >= 82) ||
        (selectorBacked && structuredBacked)
      );
    var status = high ? "high" : "verify";
    var reason = conflict
      ? "Two different prices were found on this page. Please verify the selected amount."
      : best.agreement >= 2
        ? "The same price was confirmed by multiple page sources."
        : selectorBacked
          ? "The current store price area was detected."
          : "A likely price was found, but it should be verified.";

    return {
      value: best.value,
      source: best.best?.source || "visible_page",
      confidence: Math.max(
        status === "high" ? 85 : 58,
        Math.min(99, best.confidence - (conflict ? 18 : 0))
      ),
      score: best.score,
      agreement: best.agreement,
      status: status,
      reason: reason,
      originalPrice: originalPriceCandidate(best.value),
      diagnostics: groups.slice(0, 5).map(function (group) {
        return {
          value: group.value,
          score: Math.round(group.score),
          confidence: Math.round(group.confidence),
          agreement: group.agreement,
          sources: Object.keys(group.sources)
        };
      })
    };
  }

  function srcsetCandidates(value) {
    var raw = cleanText(value);
    if (!raw) return [];

    return raw.split(",").map(function (part) {
      var pieces = cleanText(part).split(/\s+/);
      var descriptor = pieces[1] || "";
      var score = 0;

      if (/\d+w$/i.test(descriptor)) {
        score = Number.parseInt(descriptor, 10) || 0;
      } else if (/\d+(?:\.\d+)?x$/i.test(descriptor)) {
        score = Math.round(
          (Number.parseFloat(descriptor) || 0) * 1000
        );
      }

      return {
        url: absoluteUrl(pieces[0]),
        quality: score * score
      };
    }).filter(function (item) {
      return Boolean(item.url);
    });
  }

  function normalizeImageUrl(value) {
    var url = absoluteUrl(value);
    if (!url) return "";

    if (store === "flipkart") {
      url = url.replace(
        /\/image\/\d+\/\d+\//i,
        "/image/832/832/"
      );
    }

    return url;
  }

  function nodeImageCandidates(node, priority) {
    if (!node) return [];

    var results = [];
    var rect = node.getBoundingClientRect();
    var naturalArea =
      Math.max(node.naturalWidth || rect.width, 0) *
      Math.max(node.naturalHeight || rect.height, 0);

    function add(value, qualityBonus) {
      var url = normalizeImageUrl(value);
      if (!url) return;

      if (
        /logo|icon|sprite|avatar|badge|banner/i.test(
          [url, node.alt, node.className, node.id].join(" ")
        )
      ) {
        return;
      }

      results.push({
        value: url,
        source: store + "_selector",
        quality:
          priority +
          naturalArea +
          Number(qualityBonus || 0)
      });
    }

    add(node.getAttribute?.("data-zoom-image"), 9000000);
    add(node.getAttribute?.("data-old-hires"), 8500000);
    add(node.getAttribute?.("data-highres"), 8000000);

    var dynamicRaw = node.getAttribute?.("data-a-dynamic-image");

    if (dynamicRaw) {
      try {
        var dynamic = JSON.parse(dynamicRaw);
        var keys = Object.keys(dynamic || {});

        for (var i = 0; i < keys.length; i += 1) {
          var size = dynamic[keys[i]] || [];
          add(
            keys[i],
            Number(size[0] || 0) * Number(size[1] || 0)
          );
        }
      } catch (_) {}
    }

    var srcsets = []
      .concat(srcsetCandidates(node.getAttribute?.("srcset")))
      .concat(srcsetCandidates(node.getAttribute?.("data-srcset")));

    for (var s = 0; s < srcsets.length; s += 1) {
      add(srcsets[s].url, srcsets[s].quality);
    }

    add(node.currentSrc, naturalArea);
    add(node.src, naturalArea);
    add(node.getAttribute?.("data-src"), naturalArea);
    add(node.getAttribute?.("data-image"), naturalArea);
    add(node.getAttribute?.("content"), naturalArea);

    var style = getComputedStyle(node);
    var background = String(style.backgroundImage || "")
      .match(/url\(["']?(.*?)["']?\)/i);

    if (background) add(background[1], naturalArea);

    return results;
  }

  function bestAmazonImageCandidate(product) {
    var candidates = [];

    function add(value, source, quality) {
      var url = normalizeImageUrl(value);
      if (!url || !/^https:\/\//i.test(url)) return;

      var imageHost = "";

      try {
        imageHost = new URL(url).hostname.toLowerCase();
      } catch (_) {
        return;
      }

      if (
        !(
          imageHost === "m.media-amazon.com" ||
          imageHost.endsWith(".media-amazon.com") ||
          imageHost.endsWith(".ssl-images-amazon.com") ||
          imageHost === "images.amazon.com"
        )
      ) {
        return;
      }

      if (/logo|icon|sprite|avatar|badge|banner/i.test(url)) {
        return;
      }

      candidates.push({
        value: url,
        source: source,
        quality: Number(quality || 0)
      });
    }

    var productNodes = Array.from(
      document.querySelectorAll(
        [
          "#landingImage",
          "#imgTagWrapperId img",
          "#main-image",
          "#main-image-container img",
          "#image-block img",
          "#imageBlock_feature_div img",
          "#ivLargeImage img",
          "img[data-a-dynamic-image]"
        ].join(",")
      )
    ).slice(0, 30);

    for (var i = 0; i < productNodes.length; i += 1) {
      var node = productNodes[i];
      var rect = node.getBoundingClientRect();
      var naturalArea =
        Math.max(node.naturalWidth || rect.width, 0) *
        Math.max(node.naturalHeight || rect.height, 0);

      add(
        node.getAttribute?.("data-old-hires"),
        "amazon_old_hires",
        20000000 + naturalArea
      );

      var dynamicRaw =
        node.getAttribute?.("data-a-dynamic-image");

      if (dynamicRaw) {
        try {
          var dynamic = JSON.parse(dynamicRaw);
          var keys = Object.keys(dynamic || {});

          for (var d = 0; d < keys.length; d += 1) {
            var size = dynamic[keys[d]] || [];
            var dynamicArea =
              Number(size[0] || 0) *
              Number(size[1] || 0);

            add(
              keys[d],
              "amazon_dynamic_image",
              18000000 + dynamicArea
            );
          }
        } catch (_) {}
      }

      var srcsets = []
        .concat(
          srcsetCandidates(
            node.getAttribute?.("srcset")
          )
        )
        .concat(
          srcsetCandidates(
            node.getAttribute?.("data-srcset")
          )
        );

      for (var s = 0; s < srcsets.length; s += 1) {
        add(
          srcsets[s].url,
          "amazon_srcset",
          16000000 + srcsets[s].quality
        );
      }

      add(
        node.currentSrc,
        "amazon_current_src",
        13000000 + naturalArea
      );
      add(
        node.src,
        "amazon_src",
        12000000 + naturalArea
      );
      add(
        node.getAttribute?.("data-src"),
        "amazon_data_src",
        11000000 + naturalArea
      );
    }

    // These were the most dependable fallbacks in the earlier working
    // Amazon implementation, so retain them after the product image nodes.
    add(
      jsonImage(product),
      "json_ld",
      10000000
    );

    add(
      firstText([
        'meta[property="og:image"]',
        'meta[name="twitter:image"]'
      ]),
      "open_graph",
      9000000
    );

    candidates.sort(function (left, right) {
      return right.quality - left.quality;
    });

    return candidates[0] || {
      value: "",
      source: "",
      quality: 0
    };
  }

  function bestImageCandidate(product) {
    if (store === "amazon") {
      return bestAmazonImageCandidate(product);
    }

    var candidates = [];

    for (var i = 0; i < rule.image.length; i += 1) {
      var nodes = document.querySelectorAll(rule.image[i]);

      for (var j = 0; j < nodes.length; j += 1) {
        candidates = candidates.concat(
          nodeImageCandidates(
            nodes[j],
            12000000 - i * 500000
          )
        );
      }
    }

    var structured = normalizeImageUrl(jsonImage(product));
    if (structured) {
      candidates.push({
        value: structured,
        source: "json_ld",
        quality: 6500000
      });
    }

    var social = normalizeImageUrl(firstText([
      'meta[property="og:image"]',
      'meta[name="twitter:image"]'
    ]));

    if (social) {
      candidates.push({
        value: social,
        source: "open_graph",
        quality: 6000000
      });
    }

    var genericNodes = Array.from(document.images || []).slice(0, 600);

    for (var g = 0; g < genericNodes.length; g += 1) {
      if (!visible(genericNodes[g])) continue;

      candidates = candidates.concat(
        nodeImageCandidates(genericNodes[g], 1000000)
      );
    }

    candidates.sort(function (left, right) {
      return right.quality - left.quality;
    });

    return candidates[0] || {
      value: "",
      source: "",
      quality: 0
    };
  }

  var product = findBestProductJson();
  var titleCandidate = bestTitleCandidate(product);
  var priceCandidate = bestPriceCandidate(
    product,
    titleCandidate.node
  );
  var imageCandidate = bestImageCandidate(product);
  var variant = firstText(rule.variant).slice(0, 180);

  var stateKey = "__S2B_SHOPPING_ASSIST_CAPTURE_V4__";
  var state = window[stateKey];

  if (!state || state.pageKey !== pageKey) {
    state = {
      pageKey: pageKey,
      passes: 0,
      titleCandidate: "",
      titleCount: 0,
      titleStable: "",
      titleSource: "",
      titleConfidence: 0,
      priceCandidate: 0,
      priceCount: 0,
      priceStable: 0,
      priceSource: "",
      priceConfidence: 0,
      priceStatus: "missing",
      priceAgreement: 0,
      priceReason: "",
      originalPrice: 0,
      priceDiagnostics: [],
      image: "",
      imageSource: "",
      imageQuality: 0
    };
  }

  state.passes += 1;

  if (titleCandidate.value) {
    if (
      cleanTitle(state.titleCandidate).toLowerCase() ===
      cleanTitle(titleCandidate.value).toLowerCase()
    ) {
      state.titleCount += 1;
    } else {
      state.titleCandidate = titleCandidate.value;
      state.titleCount = 1;
      state.titleStable = "";
    }

    state.titleSource = titleCandidate.source;
    state.titleConfidence = titleCandidate.confidence;

    if (
      state.titleCount >= 2 ||
      (
        state.passes >= 4 &&
        state.titleConfidence >= 85
      )
    ) {
      state.titleStable = state.titleCandidate;
    }
  }

  if (priceCandidate.value > 0) {
    if (
      samePrice(
        Number(state.priceCandidate || 0),
        Number(priceCandidate.value)
      )
    ) {
      state.priceCount += 1;
    } else {
      state.priceCandidate = priceCandidate.value;
      state.priceCount = 1;
      state.priceStable = 0;
    }

    state.priceSource = priceCandidate.source;
    state.priceConfidence = priceCandidate.confidence;
    state.priceStatus = priceCandidate.status;
    state.priceAgreement = priceCandidate.agreement;
    state.priceReason = priceCandidate.reason;
    state.originalPrice = priceCandidate.originalPrice;
    state.priceDiagnostics = priceCandidate.diagnostics;

    if (
      state.priceCount >= 2 ||
      (
        state.passes >= 4 &&
        state.priceConfidence >= 88 &&
        state.priceStatus === "high"
      )
    ) {
      state.priceStable = state.priceCandidate;
    }
  } else {
    state.priceCandidate = 0;
    state.priceCount = 0;
    state.priceStable = 0;
    state.priceSource = "";
    state.priceConfidence = 0;
    state.priceStatus = "missing";
    state.priceAgreement = 0;
    state.priceReason = priceCandidate.reason || "No reliable current selling price was found.";
    state.originalPrice = 0;
    state.priceDiagnostics = [];
  }

  if (
    imageCandidate.value &&
    imageCandidate.quality >= state.imageQuality
  ) {
    state.image = imageCandidate.value;
    state.imageSource = imageCandidate.source;
    state.imageQuality = imageCandidate.quality;
  }

  window[stateKey] = state;

  var title = state.titleStable || "";
  var price = Number(state.priceStable || 0);
  var image = state.image || imageCandidate.value || "";

  var method = "visible_page";
  var sources = [
    state.titleSource,
    state.priceSource,
    state.imageSource
  ].join(" ");

  if (sources.indexOf("_selector") >= 0) {
    method = "store_selector";
  } else if (sources.indexOf("json_ld") >= 0) {
    method = "json_ld";
  } else if (sources.indexOf("open_graph") >= 0) {
    method = "open_graph";
  }

  var confidence = 15;
  if (title) confidence += 30;
  if (price > 0) {
    confidence += Math.round(
      Math.max(18, Math.min(35, state.priceConfidence * 0.35))
    );
  }
  if (image) confidence += 20;
  if (pageKey) confidence += 10;

  return JSON.stringify({
    sourceUrl: sourceUrl,
    canonicalUrl: canonical,
    store: store,
    title: title,
    image: image,
    displayedPrice: price,
    currency: "INR",
    variant: variant,
    captureMethod: method,
    confidence: Math.min(confidence, 100),
    titleStable: Boolean(title),
    priceStable: price > 0,
    titleCandidate: state.titleCandidate,
    priceCandidate: state.priceCandidate,
    titleSource: state.titleSource,
    priceSource: state.priceSource,
    priceConfidence: state.priceConfidence,
    priceStatus: price > 0 ? state.priceStatus : "missing",
    priceAgreement: state.priceAgreement,
    priceReason: state.priceReason,
    originalPrice: price > 0 ? state.originalPrice : 0,
    priceDiagnostics: state.priceDiagnostics,
    imageSource: state.imageSource,
    imageQuality: state.imageQuality,
    capturePass: state.passes,
    pageKey: pageKey,
    capturedAt: Date.now()
  });
})()
