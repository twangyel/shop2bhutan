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

  function parsePlainPrice(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value > 0
        ? value
        : 0;
    }

    var raw = cleanText(value).replace(/,/g, "");
    var match = raw.match(/\d+(?:\.\d{1,2})?/);
    if (!match) return 0;

    var number = Number(match[0]);

    return (
      Number.isFinite(number) &&
      number > 0 &&
      number < 100000000
    )
      ? number
      : 0;
  }

  function currencyPrices(value) {
    var raw = cleanText(value);
    var matches = [];
    var expression = /(?:₹|INR|Rs\.?|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi;
    var match;

    while ((match = expression.exec(raw)) !== null) {
      var number = Number(match[1].replace(/,/g, ""));

      if (
        Number.isFinite(number) &&
        number > 0 &&
        number < 100000000
      ) {
        matches.push(number);
      }
    }

    return matches;
  }

  function jsonPrice(product) {
    if (!product) return 0;

    var offers = product.offers || product.offer || [];
    var offerList = Array.isArray(offers)
      ? offers
      : [offers];

    var preferred = [];

    for (var i = 0; i < offerList.length; i += 1) {
      var offer = offerList[i] || {};

      preferred.push(
        offer.price,
        offer.salePrice,
        offer.sellingPrice,
        offer.selling_price,
        offer.discountedPrice,
        offer.discounted_price,
        offer.lowPrice
      );
    }

    preferred.push(
      product.price,
      product.salePrice,
      product.sellingPrice,
      product.selling_price,
      product.discountedPrice,
      product.discounted_price,
      product.productPrice,
      product.product_price,
      product.finalPrice,
      product.final_price
    );

    for (var p = 0; p < preferred.length; p += 1) {
      var price = parsePlainPrice(preferred[p]);
      if (price > 0) return price;
    }

    return 0;
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

    var parent = node.parentElement;

    return cleanText([
      node.id,
      node.className,
      node.getAttribute?.("aria-label"),
      node.getAttribute?.("data-testid"),
      parent?.id,
      parent?.className,
      parent?.getAttribute?.("data-testid")
    ].join(" ")).toLowerCase();
  }

  function rejectedPriceNode(node) {
    if (!node || !visible(node)) return true;

    if (node.closest("del, s, strike")) return true;

    var style = getComputedStyle(node);
    if (/line-through/i.test(style.textDecorationLine || "")) {
      return true;
    }

    var structural = structuralContext(node);
    var ownText = cleanText(node.textContent).toLowerCase();
    var parentText = cleanText(node.parentElement?.textContent).toLowerCase();

    if (
      /mrp|original|old.?price|list.?price|strike|discount.?percent|coupon|cashback|bank.?offer|emi|exchange|delivery.?charge|shipping.?charge/.test(
        structural
      )
    ) {
      return true;
    }

    if (
      /^(mrp|original price|old price|list price|coupon|cashback|emi|bank offer|effective price)\b/.test(
        ownText
      )
    ) {
      return true;
    }

    if (
      parentText.length <= 150 &&
      /coupon|cashback|bank offer|emi|effective price|with offer|using coupon|exchange offer/.test(
        parentText
      )
    ) {
      return true;
    }

    return false;
  }

  function priceNodeValues(node) {
    var raw =
      node.getAttribute?.("content") ||
      node.getAttribute?.("value") ||
      node.textContent;

    var values = currencyPrices(raw);

    if (!values.length && node.hasAttribute?.("content")) {
      var plain = parsePlainPrice(raw);
      if (plain > 0) values.push(plain);
    }

    return values;
  }

  function priceCandidateScore(
    node,
    base,
    valueIndex,
    titleNode
  ) {
    var style = getComputedStyle(node);
    var rect = node.getBoundingClientRect();
    var score =
      base +
      Number.parseFloat(style.fontSize || "0") * 3 -
      valueIndex * 30;

    var context = structuralContext(node);

    if (
      /selling|sale.?price|current|final|payable|price.?to.?pay|product.?price/.test(
        context
      )
    ) {
      score += 55;
    } else if (/price/.test(context)) {
      score += 25;
    }

    if (titleNode && visible(titleNode)) {
      var titleRect = titleNode.getBoundingClientRect();
      var distance = Math.abs(rect.top - titleRect.bottom);

      score += Math.max(0, 130 - distance / 3);

      if (rect.top < titleRect.top - 180) {
        score -= 90;
      }
    }

    if (
      rect.top >= -100 &&
      rect.top <= window.innerHeight * 1.8
    ) {
      score += 20;
    }

    return score;
  }

  function selectorPriceCandidates(titleNode) {
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
            confidence: Math.max(72, 98 - i * 3),
            score: priceCandidateScore(
              node,
              600 - i * 24,
              v,
              titleNode
            )
          });
        }
      }
    }

    return candidates;
  }

  function genericPriceCandidates(titleNode) {
    var nodes = document.querySelectorAll("body *");
    var limit = Math.min(nodes.length, 4200);
    var candidates = [];

    for (var i = 0; i < limit; i += 1) {
      var node = nodes[i];

      if (
        rejectedPriceNode(node) ||
        node.children.length > 3
      ) {
        continue;
      }

      var text = cleanText(node.textContent);

      if (
        !text ||
        text.length > 90 ||
        !/(₹|INR|Rs\.?|रु\.?)/i.test(text)
      ) {
        continue;
      }

      var values = currencyPrices(text);

      for (var v = 0; v < values.length; v += 1) {
        candidates.push({
          value: values[v],
          source: "visible_page",
          confidence: 62,
          score: priceCandidateScore(
            node,
            260,
            v,
            titleNode
          )
        });
      }
    }

    return candidates;
  }

  function bestPriceCandidate(product, titleNode) {
    var candidates = selectorPriceCandidates(titleNode);

    var metadataPrice = parsePlainPrice(firstText([
      'meta[property="product:price:amount"]',
      'meta[itemprop="price"]',
      '[itemprop="price"]'
    ]));

    if (metadataPrice > 0) {
      candidates.push({
        value: metadataPrice,
        source: "metadata",
        confidence: 90,
        score: 530
      });
    }

    var structuredPrice = jsonPrice(product);

    if (structuredPrice > 0) {
      candidates.push({
        value: structuredPrice,
        source: "json_ld",
        confidence: 88,
        score: 500
      });
    }

    candidates = candidates.concat(
      genericPriceCandidates(titleNode)
    );

    candidates.sort(function (left, right) {
      return right.score - left.score;
    });

    return candidates[0] || {
      value: 0,
      source: "",
      confidence: 0,
      score: 0
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

  var stateKey = "__S2B_SHOPPING_ASSIST_CAPTURE_V3__";
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
      Math.abs(
        Number(state.priceCandidate || 0) -
        Number(priceCandidate.value)
      ) < 0.01
    ) {
      state.priceCount += 1;
    } else {
      state.priceCandidate = priceCandidate.value;
      state.priceCount = 1;
      state.priceStable = 0;
    }

    state.priceSource = priceCandidate.source;
    state.priceConfidence = priceCandidate.confidence;

    if (
      state.priceCount >= 2 ||
      (
        state.passes >= 4 &&
        state.priceConfidence >= 90
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
  if (title) confidence += 35;
  if (price > 0) confidence += 30;
  if (image) confidence += 20;

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
    imageSource: state.imageSource,
    imageQuality: state.imageQuality,
    capturePass: state.passes,
    pageKey: pageKey,
    capturedAt: Date.now()
  });
})()
