(function () {
  "use strict";

  var host = String(location.hostname || "").toLowerCase();
  var sourceUrl = String(location.href || "");
  var canonical =
    document.querySelector('link[rel="canonical"]')?.href ||
    sourceUrl;

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\u200e|\u200f/g, "")
      .trim();
  }

  function textFromNode(node) {
    if (!node) return "";

    return cleanText(
      node.getAttribute?.("content") ||
      node.getAttribute?.("value") ||
      node.textContent
    );
  }

  function firstText(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var node = document.querySelector(selectors[i]);
      var text = textFromNode(node);
      if (text) return text;
    }
    return "";
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

  function imageFromNode(node) {
    if (!node) return "";

    var direct =
      node.currentSrc ||
      node.src ||
      node.getAttribute?.("data-old-hires") ||
      node.getAttribute?.("data-a-dynamic-image") ||
      node.getAttribute?.("data-src") ||
      node.getAttribute?.("data-image") ||
      node.getAttribute?.("content");

    if (direct && String(direct).trim().charAt(0) === "{") {
      try {
        var dynamic = JSON.parse(direct);
        var keys = Object.keys(dynamic || {});
        if (keys.length) direct = keys[0];
      } catch (_) {}
    }

    if (direct) return absoluteUrl(direct);

    var style = getComputedStyle(node);
    var match = String(style.backgroundImage || "")
      .match(/url\(["']?(.*?)["']?\)/i);

    return match ? absoluteUrl(match[1]) : "";
  }

  function firstImage(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j += 1) {
        var image = imageFromNode(nodes[j]);

        if (image && !/sprite|logo|icon|avatar/i.test(image)) {
          return image;
        }
      }
    }

    return "";
  }

  function parsePrices(value) {
    var raw = cleanText(value)
      .replace(/₹|INR|Rs\.?|रु\.?/gi, "")
      .replace(/,/g, "");

    var matches = raw.match(/\d+(?:\.\d{1,2})?/g);
    if (!matches || !matches.length) return [];

    return matches
      .map(function (part) {
        return Number(part);
      })
      .filter(function (number) {
        return (
          Number.isFinite(number) &&
          number > 0 &&
          number < 100000000
        );
      });
  }

  function parsePrice(value) {
    var values = parsePrices(value);
    return values.length ? values[0] : 0;
  }

  function findProductJson(value, depth, seen) {
    if (!value || depth > 9) return null;

    if (typeof value === "object") {
      if (seen.indexOf(value) >= 0) return null;
      seen.push(value);
    }

    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i += 1) {
        var nestedArray = findProductJson(
          value[i],
          depth + 1,
          seen
        );

        if (nestedArray) return nestedArray;
      }

      return null;
    }

    if (typeof value !== "object") return null;

    var type = value["@type"] || value.type;
    var typeText = Array.isArray(type)
      ? type.join(" ")
      : String(type || "");

    if (
      /(^|\s)product(\s|$)/i.test(typeText) ||
      (
        (value.name || value.title) &&
        (value.offers || value.price || value.images || value.image)
      )
    ) {
      return value;
    }

    var keys = Object.keys(value);

    for (var k = 0; k < keys.length; k += 1) {
      var key = keys[k];

      if (
        /review|breadcrumb|seller|organization|aggregateRating/i.test(key)
      ) {
        continue;
      }

      var nested = findProductJson(
        value[key],
        depth + 1,
        seen
      );

      if (nested) return nested;
    }

    return null;
  }

  function jsonProduct() {
    var scripts = Array.from(
      document.querySelectorAll(
        'script[type="application/ld+json"], script#__NEXT_DATA__'
      )
    ).slice(0, 20);

    for (var i = 0; i < scripts.length; i += 1) {
      var text = cleanText(scripts[i].textContent);
      if (!text || text.length > 4000000) continue;

      try {
        var parsed = JSON.parse(text);
        var product = findProductJson(parsed, 0, []);
        if (product) return product;
      } catch (_) {}
    }

    return null;
  }

  function jsonImage(product) {
    if (!product) return "";

    var value =
      product.image ||
      product.images ||
      product.imageUrl ||
      product.thumbnailUrl;

    if (Array.isArray(value)) value = value[0];

    if (value && typeof value === "object") {
      value =
        value.url ||
        value.contentUrl ||
        value.src;
    }

    return absoluteUrl(value);
  }

  function jsonPrice(product) {
    if (!product) return 0;

    var offers = product.offers || product.offer || [];
    var list = Array.isArray(offers)
      ? offers
      : [offers];

    var preferred = [];
    var fallback = [];

    for (var i = 0; i < list.length; i += 1) {
      var offer = list[i] || {};

      preferred.push(
        offer.price,
        offer.salePrice
      );

      fallback.push(
        offer.lowPrice,
        offer.highPrice
      );
    }

    preferred.push(
      product.price,
      product.salePrice
    );

    for (var p = 0; p < preferred.length; p += 1) {
      var preferredPrice = parsePrice(preferred[p]);
      if (preferredPrice > 0) return preferredPrice;
    }

    for (var f = 0; f < fallback.length; f += 1) {
      var fallbackPrice = parsePrice(fallback[f]);
      if (fallbackPrice > 0) return fallbackPrice;
    }

    return 0;
  }

  function genericVisibleImage() {
    var nodes = Array.from(
      document.images || []
    ).slice(0, 800);

    var candidates = nodes
      .filter(visible)
      .map(function (node) {
        var src = imageFromNode(node);
        var rect = node.getBoundingClientRect();
        var area =
          Math.max(node.naturalWidth || rect.width, 0) *
          Math.max(node.naturalHeight || rect.height, 0);

        var penalty =
          /logo|icon|sprite|avatar|badge|banner/i.test(
            [
              src,
              node.alt,
              node.className,
              node.id
            ].join(" ")
          )
            ? 10000000
            : 0;

        return {
          src: src,
          score:
            area -
            penalty -
            Math.abs(rect.top) * 15
        };
      })
      .filter(function (item) {
        return (
          item.src &&
          item.src.indexOf("https://") === 0 &&
          item.score > 10000
        );
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    return candidates.length
      ? candidates[0].src
      : "";
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

  var rules = {
    amazon: {
      root: [
        "#dp-container",
        "#ppd",
        "main"
      ],
      title: [
        "#productTitle",
        "#title span",
        "h1.a-size-large",
        "h1"
      ],
      price: [
        "#corePrice_feature_div .priceToPay .a-offscreen",
        "#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen",
        "#apex_desktop .priceToPay .a-offscreen",
        "#apex_desktop .a-price:not(.a-text-price) .a-offscreen",
        "#priceblock_dealprice",
        "#priceblock_ourprice",
        "#price_inside_buybox"
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
      root: [
        "#container",
        "main"
      ],
      title: [
        "h1 span.VU-ZEz",
        "h1 span.B_NuCI",
        "span.VU-ZEz",
        "span.B_NuCI",
        "h1"
      ],
      price: [
        "div.Nx9bqj.CxhGGd",
        "div.Nx9bqj:not([class*='yRaY8j'])",
        "div._30jeq3:not(._3I9_wc)",
        "[itemprop='price']",
        "[class*='sellingPrice']",
        "[class*='SellingPrice']"
      ],
      image: [
        "img.DByuf4",
        "img._396cs4",
        "img[loading='eager']",
        "picture img"
      ],
      variant: [
        "[aria-selected='true']",
        "[class*='selected']"
      ]
    },

    myntra: {
      root: [
        ".pdp-details",
        ".pdp-description-container",
        "main"
      ],
      title: [
        ".pdp-name",
        ".pdp-title",
        "h1"
      ],
      price: [
        ".pdp-price strong",
        ".pdp-price .pdp-mrp + strong",
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
      root: [
        "main",
        "[class*='ProductDetails']",
        "[class*='product-details']"
      ],
      title: [
        "[class*='ProductTitle']",
        "[class*='product-title']",
        "[class*='ProductDetails'] h1",
        "main h1",
        "h1"
      ],
      price: [
        "[class*='ProductPrice']",
        "[class*='product-price']",
        "[class*='SellingPrice']",
        "[class*='selling-price']",
        "[itemprop='price']",
        "main h4"
      ],
      image: [
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
    root: ["main"],
    title: ["h1"],
    price: [],
    image: ["main img", "picture img"],
    variant: []
  };

  function firstNode(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var node = document.querySelector(selectors[i]);
      if (node) return node;
    }

    return null;
  }

  function usefulTitle(value) {
    var clean = cleanText(value);

    if (clean.length < 5) return false;

    return !/^(amazon(?:\.in)?|flipkart|myntra|meesho|online shopping|shopping)$/i.test(
      clean
    );
  }

  function selectorTitle() {
    if (store === "myntra") {
      var brand = firstText([".pdp-title"]);
      var name = firstText([".pdp-name"]);

      if (
        usefulTitle(brand) &&
        usefulTitle(name) &&
        brand.toLowerCase() !== name.toLowerCase()
      ) {
        return cleanText(brand + " " + name);
      }

      if (usefulTitle(name)) return name;
      if (usefulTitle(brand)) return brand;
    }

    var title = firstText(rule.title);
    return usefulTitle(title) ? title : "";
  }

  function priceContext(node) {
    if (!node) return "";

    var parent = node.parentElement;
    var grandParent = parent?.parentElement;

    return cleanText(
      [
        node.id,
        node.className,
        node.getAttribute?.("aria-label"),
        node.getAttribute?.("data-testid"),
        node.textContent,
        parent?.id,
        parent?.className,
        parent?.textContent,
        grandParent?.id,
        grandParent?.className
      ].join(" ")
    ).toLowerCase();
  }

  function structuralPriceContext(node) {
    if (!node) return "";

    var parent = node.parentElement;
    var grandParent = parent?.parentElement;

    return cleanText(
      [
        node.id,
        node.className,
        node.getAttribute?.("aria-label"),
        node.getAttribute?.("data-testid"),
        parent?.id,
        parent?.className,
        grandParent?.id,
        grandParent?.className
      ].join(" ")
    ).toLowerCase();
  }

  function rejectedPriceNode(node) {
    if (!node || !visible(node)) return true;

    if (node.closest("del, s, strike")) {
      return true;
    }

    var structural = structuralPriceContext(node);
    var ownText = cleanText(node.textContent).toLowerCase();
    var nearbyText = cleanText(
      [
        ownText,
        node.parentElement?.textContent
      ].join(" ")
    ).toLowerCase();

    if (
      /mrp|maximum retail|original price|old price|list price|strike|striked|was price/.test(
        structural
      ) ||
      /^(mrp|maximum retail|original price|old price|list price|was price)\b/.test(
        ownText
      )
    ) {
      return true;
    }

    if (
      /coupon|bank offer|cashback|emi|effective price|with offer|using coupon|delivery charge|shipping charge|exchange offer/.test(
        structural
      ) ||
      /coupon|bank offer|cashback|emi|effective price|with offer|using coupon|delivery charge|shipping charge|exchange offer/.test(
        nearbyText
      )
    ) {
      return true;
    }

    return false;
  }

  function candidateScore(
    node,
    selectorPriority,
    valueIndex,
    productRoot
  ) {
    var style = getComputedStyle(node);
    var rect = node.getBoundingClientRect();
    var context = priceContext(node);

    var score =
      selectorPriority +
      Number.parseFloat(style.fontSize || "0") * 3 -
      valueIndex * 35;

    if (
      productRoot &&
      (
        productRoot === node ||
        productRoot.contains(node)
      )
    ) {
      score += 70;
    }

    if (
      /selling|saleprice|sale-price|current|final|payable|pricepay|pricetopay|price-to-pay/.test(
        context
      )
    ) {
      score += 45;
    }

    if (/price/.test(context)) {
      score += 20;
    }

    if (
      rect.top >= -100 &&
      rect.top <= window.innerHeight * 1.6
    ) {
      score += 15;
    }

    return score;
  }

  function collectPriceCandidates(
    selectors,
    productRoot,
    basePriority
  ) {
    var candidates = [];

    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j += 1) {
        var node = nodes[j];
        if (rejectedPriceNode(node)) continue;

        var raw =
          node.getAttribute("content") ||
          node.getAttribute("value") ||
          node.textContent;

        var values = parsePrices(raw);

        for (var v = 0; v < values.length; v += 1) {
          candidates.push({
            price: values[v],
            score: candidateScore(
              node,
              basePriority - i * 25,
              v,
              productRoot
            )
          });
        }
      }
    }

    return candidates;
  }

  function genericVisiblePrice(productRoot) {
    var scope = productRoot || document.body;
    var nodes = scope.querySelectorAll("*");
    var limit = Math.min(nodes.length, 2600);
    var candidates = [];

    for (var i = 0; i < limit; i += 1) {
      var node = nodes[i];

      if (
        rejectedPriceNode(node) ||
        node.children.length > 4
      ) {
        continue;
      }

      var text = cleanText(node.textContent);

      if (
        !text ||
        text.length > 80 ||
        !/(₹|INR|Rs\.?)/i.test(text)
      ) {
        continue;
      }

      var values = parsePrices(text);

      for (var v = 0; v < values.length; v += 1) {
        candidates.push({
          price: values[v],
          score: candidateScore(
            node,
            80,
            v,
            productRoot
          )
        });
      }
    }

    candidates.sort(function (a, b) {
      return b.score - a.score;
    });

    return candidates.length
      ? candidates[0].price
      : 0;
  }

  function bestSelectorPrice(productRoot) {
    var candidates = collectPriceCandidates(
      rule.price,
      productRoot,
      500
    );

    candidates.sort(function (a, b) {
      return b.score - a.score;
    });

    return candidates.length
      ? candidates[0].price
      : 0;
  }

  var structured = jsonProduct();
  var productRoot = firstNode(rule.root);

  var selectedTitle = selectorTitle();
  var structuredTitle = cleanText(
    structured?.name ||
    structured?.title
  );
  var openGraphTitle = firstText([
    'meta[property="og:title"]',
    'meta[name="twitter:title"]'
  ]);
  var visibleHeading = firstText([
    "main h1",
    "h1"
  ]);

  var title =
    selectedTitle ||
    (usefulTitle(structuredTitle) ? structuredTitle : "") ||
    (usefulTitle(openGraphTitle) ? openGraphTitle : "") ||
    (usefulTitle(visibleHeading) ? visibleHeading : "") ||
    cleanText(document.title);

  title = title
    .replace(
      /\s*[|:-]\s*(Amazon\.in|Flipkart|Myntra|Meesho).*$/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);

  var selectorPrice = bestSelectorPrice(productRoot);
  var structuredPrice = jsonPrice(structured);
  var metaPrice = parsePrice(
    firstText([
      'meta[property="product:price:amount"]',
      'meta[itemprop="price"]',
      '[itemprop="price"]'
    ])
  );
  var visiblePrice = genericVisiblePrice(productRoot);

  var price =
    selectorPrice ||
    structuredPrice ||
    metaPrice ||
    visiblePrice ||
    0;

  // Keep the existing image extraction order because it is already
  // performing reliably across the supported stores.
  var image =
    jsonImage(structured) ||
    firstImage(rule.image) ||
    firstText([
      'meta[property="og:image"]',
      'meta[name="twitter:image"]'
    ]) ||
    genericVisibleImage();

  image = absoluteUrl(image);

  var variant =
    firstText(rule.variant)
      .slice(0, 180);

  var method = "visible_page";

  if (selectedTitle || selectorPrice) {
    method = "store_selector";
  } else if (
    structuredTitle ||
    structuredPrice ||
    jsonImage(structured)
  ) {
    method = "json_ld";
  } else if (
    openGraphTitle ||
    metaPrice
  ) {
    method = "open_graph";
  }

  var confidence = 0;

  if (title && title.length >= 5) {
    confidence += 35;
  }

  if (price > 0) {
    confidence += selectorPrice ? 30 : 25;
  }

  if (
    image &&
    image.indexOf("https://") === 0
  ) {
    confidence += 20;
  }

  if (
    /\/dp\/|\/gp\/product\/|\/p\/|pid=|\/s\/p\/|\/\d+(?:\/|$|\?)/i.test(
      sourceUrl
    )
  ) {
    confidence += 20;
  }

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
    capturedAt: Date.now()
  });
})()
