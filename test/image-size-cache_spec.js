var should = require('should'),
    sinon = require('sinon'),
    Promise = require('bluebird'),
    rewire = require('rewire'),

    // Stuff we are testing
    imageSizeCache = rewire('../lib/image-size-cache'),

    sandbox = sinon.sandbox.create();

describe('Image Size Cache', function () {
    var sizeOfStub,
        cachedImagedSize;

    beforeEach(function () {
        sizeOfStub = sandbox.stub();
    });

    afterEach(function () {
        sandbox.restore();
        imageSizeCache.__set__('imageSizeCache', {});
    });

    it('should read from cache, if dimensions for image are fetched already', function (done) {
        var url = 'http://mysite.com/content/image/mypostcoverimage.jpg',
            cachedImagedSizeResult,
            imageSizeSpy;

        sizeOfStub.returns(new Promise.resolve({
            width: 50,
            height: 50,
            type: 'jpg'
        }));

        imageSizeCache.__set__('imageSize', sizeOfStub);

        imageSizeSpy = imageSizeCache.__get__('imageSize');

        cachedImagedSizeResult = Promise.resolve(imageSizeCache(url));
        cachedImagedSizeResult.then(function () {
            // first call to get result from `getImageSizeFromUrl`
            cachedImagedSize = imageSizeCache.__get__('imageSizeCache');
            should.exist(cachedImagedSize);
            cachedImagedSize.should.have.property(url);
            should.exist(cachedImagedSize[url].width);
            cachedImagedSize[url].width.should.be.equal(50);
            should.exist(cachedImagedSize[url].height);
            cachedImagedSize[url].height.should.be.equal(50);

            // second call to check if values get returned from cache
            cachedImagedSizeResult = Promise.resolve(imageSizeCache(url));
            cachedImagedSizeResult.then(function () {
                cachedImagedSize = imageSizeCache.__get__('imageSizeCache');
                imageSizeSpy.calledOnce.should.be.true();
                imageSizeSpy.calledTwice.should.be.false();
                should.exist(cachedImagedSize);
                cachedImagedSize.should.have.property(url);
                should.exist(cachedImagedSize[url].width);
                cachedImagedSize[url].width.should.be.equal(50);
                should.exist(cachedImagedSize[url].height);
                cachedImagedSize[url].height.should.be.equal(50);

                done();
            });
        }).catch(done);
    });

    it('can handle image-size errors', function (done) {
        var url = 'http://mysite.com/content/image/mypostcoverimage.jpg',
            cachedImagedSizeResult;

        sizeOfStub.returns(new Promise.reject('error'));

        imageSizeCache.__set__('imageSize', sizeOfStub);

        cachedImagedSizeResult = Promise.resolve(imageSizeCache(url));
        cachedImagedSizeResult.then(function () {
                cachedImagedSize = imageSizeCache.__get__('imageSizeCache');
                should.exist(cachedImagedSize);
                cachedImagedSize.should.have.property(url);
                should.not.exist(cachedImagedSize[url].width);
                should.not.exist(cachedImagedSize[url].height);
                done();
            }).catch(done);
    });

    it('should return null if url is undefined', function (done) {
        var url = null,
            result;

        result = imageSizeCache(url);

        should.not.exist(result);
        done();
    });
});
