var debug  = require('debug')('amp-html:converter'),
    htmlparser = require('htmlparser2'),
    Promise = require('bluebird'),
    _ = require('lodash'),
    toHtml = require('./to-html'),
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

function traverseDom(html) {
    var handler,
        parser,
        nodePromises = [];

    handler = new htmlparser.DomHandler(function (error, dom) {
        if (error) {
            return reject(error);
            console.log('error:', error);
        }
    });

    parser = new htmlparser.Parser(handler);
    parser.parseComplete(html);

    debug('Traverse DOM');
    // Traverse through the DOM and convert elements
    _.forEach(handler.dom, function (element) {
        nodePromises.push(processNodes(element).then(function (element) {
            return Promise.resolve(element);
        }));
    });

    return Promise.all(nodePromises).then(function (convertedDom) {
        return convertedDom;
    });
}

function processNodes(element) {
    return new Promise(function processNodes(resolve, reject) {
        debug('Process Node:', element);
        // CASE: img and iframes without src property will not be processed
        if ((element.name === 'img' || element.name === 'iframe') && !element.attribs.src) {
            debug('image or iframe without src attribute');
            return resolve(element);
        }

        if (element.name === 'iframe') {
            element.name = 'amp-iframe';

            if (!element.attribs.width || !element.attribs.height || !element.attribs.layout) {
                element.attribs.width = !element.attribs.width ? DEFAULTS['amp-iframe'].width : element.attribs.width;
                element.attribs.height = !element.attribs.height ? DEFAULTS['amp-iframe'].height : element.attribs.height;
                element.attribs.sandbox = !element.attribs.sandbox ? DEFAULTS['amp-iframe'].sandbox : element.attribs.sandbox;
            }

            element = getLayoutAttribute(useSecureSchema(element));
        }

        if (element.name === 'audio') {
            element.name = 'amp-audio';
        }

        if (element.name === 'img' && DEFAULTS['amp-img']) {
            // CASE: .gif files need to be <amp-anim>.
            element.name = element.attribs.src.match(/(\.gif$)/) ? 'amp-anim' : 'amp-img';
            // getCachedImageSize always returns a resolved value, even if image-size errors
            getCachedImageSize(element.attribs.src, 5000).then(function (dimensions) {
                if (!dimensions.width || !dimensions.height) {
                    // Fallback to default values for a local image
                    element.attribs.width = DEFAULTS['amp-img'].width;
                    element.attribs.height = DEFAULTS['amp-img'].height;
                } else {
                    element.attribs.width = dimensions.width;
                    element.attribs.height = dimensions.height;
                }

                return resolve(getLayoutAttribute(element));
            });
        } else {
            return resolve(element);
        }
    });
}

module.exports = function parser(html) {
    return new Promise(function parser(resolve, reject) {
        return traverseDom(html).then(function (result) {
            debug('Resolve traversed DOM');
            return resolve(toHtml(result));
        }).catch(function (err) {
            return reject(err);
        });
    });
};
