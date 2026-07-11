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

  function firstText(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var node = document.querySelector(selectors[i]);
      if (!node) continue;
      var text = cleanText(
        node.getAttribute("content") ||
        node.textContent ||
        node.getAttribute("value")
      );
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

  function parsePrice(value) {
    var raw = cleanText(value)
      .replace(/₹|INR|Rs\.?|रु\.?/gi, "")
      .replace(/,/g, " ");

    var matches = raw.match(/\d+(?:\s\d{3})*(?:\.\d{1,2})?/g);
    if (!matches || !matches.length) return 0;

    var values = matches
      .map(function (part) {
        return Number(part.replace(/\s/g, ""));
      })
      .filter(function (number) {
        return Number.isFinite(number) && number > 0 && number < 100000000;
      });

    return values.length ? values[0] : 0;
  }

  function firstPrice(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j += 1) {
        if (!visible(nodes[j])) continue;
        var value =
          nodes[j].getAttribute("content") ||
          nodes[j].textContent;
        var price = parsePrice(value);
        if (price > 0) return price;
      }
    }
    return 0;
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

    var offers = product.offers || product.offer || {};
    if (Array.isArray(offers)) offers = offers[0] || {};

    return parsePrice(
      offers.price ||
      offers.lowPrice ||
      offers.salePrice ||
      product.price ||
      product.salePrice
    );
  }

  function genericVisiblePrice() {
    var candidates = [];
    var nodes = document.querySelectorAll(
      "body *"
    );
    var limit = Math.min(nodes.length, 3500);

    for (var i = 0; i < limit; i += 1) {
      var node = nodes[i];
      if (!visible(node)) continue;

      var text = cleanText(node.textContent);
      if (
        !text ||
        text.length > 55 ||
        !/(₹|INR|Rs\.?)/i.test(text)
      ) {
        continue;
      }

      var classText = String(
        node.className || ""
      ).toLowerCase();

      if (
        /mrp|strike|original|old-price|discount-label/.test(classText) ||
        node.closest("del, s, strike")
      ) {
        continue;
      }

      var price = parsePrice(text);
      if (!price) continue;

      var style = getComputedStyle(node);
      var fontSize =
        Number.parseFloat(style.fontSize || "0");
      var rect = node.getBoundingClientRect();

      var score =
        fontSize * 3 +
        Math.max(0, 20 - Math.abs(rect.top) / 120);

      if (/price|selling|payable|final/.test(classText)) {
        score += 30;
      }

      candidates.push({
        price: price,
        score: score
      });
    }

    candidates.sort(function (a, b) {
      return b.score - a.score;
    });

    return candidates.length
      ? candidates[0].price
      : 0;
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
  if (host.indexOf("amazon.") >= 0 || host.indexOf("amzn.") >= 0) {
    store = "amazon";
  } else if (host.indexOf("flipkart.") >= 0 || host.indexOf("fkrt.") >= 0) {
    store = "flipkart";
  } else if (host.indexOf("myntra.") >= 0) {
    store = "myntra";
  } else if (host.indexOf("meesho.") >= 0) {
    store = "meesho";
  }

  var rules = {
    amazon: {
      title: [
        "#productTitle",
        "#title span",
        "h1.a-size-large",
        "h1"
      ],
      price: [
        "#corePrice_feature_div .priceToPay .a-offscreen",
        "#corePrice_feature_div .a-price .a-offscreen",
        "#apex_desktop .a-price .a-offscreen",
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
      title: [
        "span.VU-ZEz",
        "span.B_NuCI",
        "h1 span",
        "h1"
      ],
      price: [
        "div.Nx9bqj.CxhGGd",
        "div.Nx9bqj",
        "div._30jeq3",
        "[class*='Nx9bqj']"
      ],
      image: [
        "img.DByuf4",
        "img._396cs4",
        "img[loading='eager']",
        "picture img"
      ],
      variant: [
        "[class*='selected']",
        "[aria-selected='true']"
      ]
    },
    myntra: {
      title: [
        ".pdp-title",
        ".pdp-name",
        ".pdp-title + .pdp-name",
        "h1"
      ],
      price: [
        ".pdp-price strong",
        ".pdp-price",
        ".pdp-discount-container strong",
        "[class*='pdp-price']"
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
        "h1",
        "[class*='ProductTitle']",
        "[class*='product-title']"
      ],
      price: [
        "[class*='ProductPrice']",
        "[class*='product-price']",
        "[class*='Price'] h4",
        "h4"
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
    title: ["h1"],
    price: [],
    image: ["main img", "picture img"],
    variant: []
  };

  var structured = jsonProduct();

  var structuredTitle = cleanText(
    structured?.name ||
    structured?.title
  );
  var selectorTitle = firstText(rule.title);
  var openGraphTitle = firstText([
    'meta[property="og:title"]',
    'meta[name="twitter:title"]'
  ]);
  var visibleHeading = firstText([
    "main h1",
    "h1"
  ]);

  var title =
    structuredTitle ||
    selectorTitle ||
    openGraphTitle ||
    visibleHeading ||
    cleanText(document.title);

  title = title
    .replace(/\s*[|:-]\s*(Amazon\.in|Flipkart|Myntra|Meesho).*$/i, "")
    .trim()
    .slice(0, 280);

  var structuredPrice = jsonPrice(structured);
  var metaPrice = parsePrice(
    firstText([
      'meta[property="product:price:amount"]',
      'meta[itemprop="price"]',
      '[itemprop="price"]'
    ])
  );
  var selectorPrice = firstPrice(rule.price);
  var visiblePrice = genericVisiblePrice();

  var price =
    selectorPrice ||
    structuredPrice ||
    metaPrice ||
    visiblePrice ||
    0;

  var image =
    jsonImage(structured) ||
    firstImage(rule.image) ||
    firstText([
      'meta[property="og:image"]',
      'meta[name="twitter:image"]'
    ]) ||
    genericVisibleImage();

  image = absoluteUrl(image);

  var variant = firstText(rule.variant).slice(0, 180);

  var method = "visible_page";
  if (structuredTitle || structuredPrice || jsonImage(structured)) {
    method = "json_ld";
  } else if (selectorTitle || selectorPrice || firstImage(rule.image)) {
    method = "store_selector";
  } else if (openGraphTitle || metaPrice) {
    method = "open_graph";
  }

  var confidence = 0;
  if (title && title.length >= 5) confidence += 35;
  if (price > 0) confidence += 25;
  if (image && image.indexOf("https://") === 0) confidence += 20;
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
