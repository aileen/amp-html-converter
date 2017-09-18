var debug  = require('debug')('amp-html:image-size-cache'),
    imageSize = require('./get-image-size'),
    imageSizeCache = {};

/**
 * Get cached image size from URL
 * Always returns {object} imageSizeCache
 * @param {string} url
 * @returns {Promise<Object>} imageSizeCache
 * @description Takes a url and returns image width and height from cache if available.
 * If not in cache, `getImageSizeFromUrl` is called and returns the dimensions in a Promise.
 */
function getCachedImageSizeFromUrl(url) {
    if (!url || url === undefined || url === null) {
        return;
    }

    return new Promise (function (resolve, reject) {
        // image size is not in cache
        if (!imageSizeCache[url]) {
            return imageSize(url).then(function (res) {
                imageSizeCache[url] = res;

                debug('Cached image:', url);

                return resolve(imageSizeCache[url]);
            }).catch(function (err) {
                debug('Cached image (error):', url);

                if (err.message !== 'Request timed out') {
                    // Time out error, can be a temporary thing, therefore we
                    // still want to return a transformed img tag.
                    // Every other error will cause to not transform the image.
                    imageSizeCache[url] = err;
                } else {
                    // in case of time out error we just attach the url
                    imageSizeCache[url] = url;
                }

                return resolve(imageSizeCache[url]);
            });
        }
        debug('Read image from cache:', url);
        // returns image size from cache
        return resolve(imageSizeCache[url]);
    });
}

module.exports = getCachedImageSizeFromUrl;
