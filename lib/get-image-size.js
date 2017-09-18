var debug  = require('debug')('amp-html:image-size'),
    sizeOf = require('image-size'),
    url = require('url'),
    Promise = require('bluebird'),
    request = require('./request'),
    _ = require('lodash'),
    getImageSize;

// Supported formats of https://github.com/image-size/image-size:
// BMP, GIF, JPEG, PNG, PSD, TIFF, WebP, SVG, ICO
// ***
// Takes the url of the image and an optional timeout
// getImageSize returns an Object like this
// {
//     height: 50,
//     width: 50
// };
// if the dimensions can be fetched, and rejects with error, if not.
// ***

/**
 * @description read image dimensions from URL
 * @param {String} imagePath as URL
 * @returns {Promise<Object>} imageObject or error
 */
getImageSize = function getImageSize(imagePath, timeout) {
    var requestOptions,
        parsedUrl,
        dimensions,
        timeout = timeout || 10000;

    parsedUrl = url.parse(imagePath);

    debug('requested imagePath:', imagePath);
    requestOptions = {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: timeout,
        encoding: null
    };

    return request(
        imagePath,
        requestOptions
    ).then(function (response) {
        debug('Image fetched:', imagePath);

        try {
            // Using the Buffer rather than an URL requires to use sizeOf synchronously.
            // See https://github.com/image-size/image-size#asynchronous
            dimensions = sizeOf(response.body);

            // CASE: `.ico` files might have multiple images and therefore multiple sizes.
            // We return the largest size found (image-size default is the first size found)
            if (dimensions.images) {
                dimensions.width = _.maxBy(dimensions.images, function (w) {return w.width;}).width;
                dimensions.height = _.maxBy(dimensions.images, function (h) {return h.height;}).height;
            }

            debug('Returned dimensions from image-size:', dimensions);
            return Promise.resolve(dimensions);
        } catch (err) {
            debug('Image-Size error:', imagePath);
            return Promise.reject(new Error(err.message || err, imagePath));
        }
    }).catch({code: 'URL_MISSING_INVALID'}, function (err) {
        debug('Url invalid:', imagePath);

        return Promise.reject('URL invalid', imagePath);
    }).catch({code: 'ETIMEDOUT'}, {statusCode: 408}, function (err) {
        debug('Request timed out:', imagePath);

        return Promise.reject(new Error('Request timed out', imagePath));
    }).catch({code: 'ENOENT'}, {statusCode: 404}, function (err) {
        debug('Image not found:', imagePath);

        return Promise.reject(new Error('Image not found', imagePath));
    }).catch(function (err) {
        if (err.message === 'Image not found' || err.message === 'Request timed out' || err.message === 'URL invalid') {
            return Promise.reject(err);
        }
        debug('Unknown request error:', imagePath);
        return Promise.reject(new Error(err.message || err, imagePath));
    });
};

module.exports = getImageSize;
