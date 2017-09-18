var debug  = require('debug')('amp-html:converter'),
    html = require('htmlparser2'),
    Promise = require('bluebird'),
    _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    emits = require('emits'),
    util = require('util'),
    uuid = require('uuid'),
    async = require('async'),
    helpers = require('./helpers'),
    getCachedImageSize = require('./image-size-cache'),
    DEFAULTS;

DEFAULTS = {
    'amp-img': {
        layout: 'responsive',
        width: 600,
        height: 400
    },
    'amp-anim': {
        layout: 'responsive',
        width: 600,
        height: 400
    },
    'amp-iframe': {
        layout: 'responsive',
        width: 600,
        height: 400,
        sandbox: 'allow-scripts allow-same-origin'
    }
};

function useSecureSchema(element) {
    if (element.attribs && element.attribs.src) {
        // Every src attribute must be with 'https' protocol otherwise it will not get validated by AMP.
        // If we're unable to replace it, we will deal with the valitation error, but at least
        // we tried.
        if (element.attribs.src.indexOf('https://') === -1) {
            if (element.attribs.src.indexOf('http://') === 0) {
                // Replace 'http' with 'https', so the validation passes
                element.attribs.src = element.attribs.src.replace(/^http:\/\//i, 'https://');
            } else if (element.attribs.src.indexOf('//') === 0) {
                // Giphy embedded iFrames are without protocol and start with '//', so at least
                // we can fix those cases.
                element.attribs.src = 'https:' + element.attribs.src;
            }
        }
    }

    return element;
}

function getLayoutAttribute(element) {
    var layout;

    // check if element.width is smaller than 300 px. In that case, we shouldn't use
    // layout="responsive", because the media element will be stretched and it doesn't
    // look nice. Use layout="fixed" instead to fix that.
    layout = element.attribs.width < 300 ? layout = 'fixed' : DEFAULTS[element.name].layout;

    element.attribs.layout = !element.attribs.layout ? layout : element.attribs.layout;

    return element;
}

function transformIframe(element) {
    element.name = 'amp-iframe';

    if (!element.attribs.width || !element.attribs.height || !element.attribs.layout) {
        element.attribs.width = !element.attribs.width ? DEFAULTS['amp-iframe'].width : element.attribs.width;
        element.attribs.height = !element.attribs.height ? DEFAULTS['amp-iframe'].height : element.attribs.height;
        element.attribs.sandbox = !element.attribs.sandbox ? DEFAULTS['amp-iframe'].sandbox : element.attribs.sandbox;
    }

    return getLayoutAttribute(useSecureSchema(element));
}

function transformImages(element) {
    // CASE: .gif files need to be <amp-anim>.
    element.name = element.attribs.src.match(/(\.gif$)/) ? 'amp-anim' : 'amp-img';
    // getCachedImageSize always returns a resolved value, even if image-size errors
    return getCachedImageSize(element.attribs.src, 5000).then(function (dimensions) {
        if (!dimensions.width || !dimensions.height) {
            if (dimensions.message) {
                // CASE: message property is populated, that means the image dimensions
                // couldn't get fetched. Therefore we won't transform the image and won't
                // append fallback image sizes.
                element.error = dimensions.message;
                element.name = 'img';
                return Promise.resolve(element);
            }
            // Fallback to default values for an image that caused a request time out
            element.attribs.width = DEFAULTS['amp-img'].width;
            element.attribs.height = DEFAULTS['amp-img'].height;
        } else {
            element.attribs.width = dimensions.width;
            element.attribs.height = dimensions.height;
        }

        return Promise.resolve(getLayoutAttribute(element));
    });
}

function processSingleNode(element) {
    return new Promise(function processSingleNode(resolve, reject) {
        if (!element.type === 'tag') {
            return resolve(element);
        }
        // CASE: img and iframes without src property will not be processed
        if ((element.name === 'img' || element.name === 'iframe') && !element.attribs.src) {
            debug('img or iframe without src attribute.');
            return resolve(element);
        }

        if (element.name === 'iframe') {
            element = transformIframe(element);
        }

        if (element.name === 'audio') {
            element.name = 'amp-audio';
        }

        if (element.name === 'img' && DEFAULTS['amp-img']) {
            element = transformImages(element);
        }

        return resolve(element);
    });
}

/**
* AmpConverter constructor. Borrows from Minimize.
*
* https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L15
*
* @constructor
* @api public
*/
function AmpConverter() {
    this.emits = emits;

    this.htmlParser = new html.Parser(
        new html.DomHandler(this.emits('read'))
    );
}

util.inherits(AmpConverter, EventEmitter);

/**
* Parse the content and call the callback. Borrowed from Minimize.
*
* https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L51
*
* @param {String} content HTML
* @param {Function} callback
* @api public
*/
AmpConverter.prototype.parse = function parse(content, callback) {
    var id;

    if (typeof callback !== 'function') {
        throw new Error('No callback provided');
    }

    id = uuid.v4();

    this.once('read', this.amperizer.bind(this, id));
    this.once('parsed: ' + id, callback);

    this.htmlParser.parseComplete(content);
};

/**
* Turn a traversible DOM into string content. Borrowed from Minimize.
*
* https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L74
*
* @param {Object} id
* @param {Object} error
* @param {Object} dom Traversible DOM object
* @api private
*/
AmpConverter.prototype.amperizer = function amperizer(id, error, dom) {
    if (error) {
        throw new Error('AmpConverter failed to parse DOM', error);
    }

    this.traverse(dom, '', this.emits('parsed: ' + id));
};

/**
* Reduce the traversible DOM object to a string. Borrows from Minimize.
*
* https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L90
*
* @param {Array} data parsable DOM Array
* @param {String} html Compiled HTML contents
* @param {Function} done Callback function
* @api private
*/
AmpConverter.prototype.traverse = function traverse(data, html, done) {
    var self = this;

    async.reduce(data, html, function reduce(html, element, step) {
        var children,
            elementPromises = [];

        function close(error, html) {
            if (error) {
                return step(error);
            }

            html += helpers.close(element);
            step(null, html);
        }

        function enter(error) {
            if (error) {
                return step(error);
            }

            children = element.children;
            html += helpers[element.type](element);

            if (!children || !children.length) {
                return close(null, html);
            }

            setImmediate(function delay() {
                traverse.call(self, children, html, close);
            });
        }

        elementPromises.push(processSingleNode(element).then(function (element) {
            return Promise.resolve(element);
        }));

        return Promise.all(elementPromises).then(function () {
            return enter();
        })
    }, done);
};

module.exports = function parser(html) {
    return new Promise(function parser(resolve, reject) {
        var ampConverter = new AmpConverter;

        ampConverter.parse(html, function (err, res) {
            if (err) {
                return reject(err);
            }

            return resolve(res);
        });
    });
};
