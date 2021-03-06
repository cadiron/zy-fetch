import Interceptor from './interceptor'
import transformResponse from '../util/transformResponse'
import transformRequest from '../util/transformRequest'
import checkStatus from '../util/checkStatus'
import getTimeoutFetch from './timeout'
import PromiseTask from './promiseTask'
import buildSearchParams from '../util/buildSearchParams'
import {isFunction} from '../util/typeCheck'
import {isAbsoluteURL, buildAbsoluteURL} from "../util/baseUrl"
import normalizeHeaderName from '../util/normalizeHeaderName'
import getRetryInterceptor from './retry'
class zyFetch {
  constructor(config, fetch) {
    this.config = config
    this.nativeFetch = fetch
    this.interceptors = {
      request: new Interceptor(),
      response: {
        transform: new Interceptor(),
        noTransform: new Interceptor()
      }
    }
  }

  send(init, option = {}) {
    let config = {}
    // merge config
    Object.assign(config, this.config, option)
    let request = this._getRequest(init, config)

    let promiseTask = new PromiseTask()
    this._initPromiseTask(promiseTask, config, request)
    return promiseTask.execute(request)
  }

  get(init, option) {
    option = this._methodsOptionMerge(option, 'get')
    return this.send(init, option)
  }

  delete(init, option) {
    option = this._methodsOptionMerge(option, 'get')
    return this.send(init, option)
  }

  options(init, option) {
    option = this._methodsOptionMerge(option, 'get')
    return this.send(init, option)
  }

  head(init, option) {
    option = this._methodsOptionMerge(option, 'get')
    return this.send(init, option)
  }


  post(init, body, option) {
    option = this._methodsOptionMerge(option, 'post', body)
    return this.send(init, option)
  }

  put(init, body, option) {
    option = this._methodsOptionMerge(option, 'put', body)
    return this.send(init, option)
  }

  patch(init, body, option) {
    option = this._methodsOptionMerge(option, 'patch', body)
    return this.send(init, option)
  }

  /**
   *
   * @param fetchs some fetch
   * @returns {Promise.<*[]>} return promise
   */
  all(fetchs) {
    return Promise.all(fetchs)
  }

  /**
   * Execute fetch in sequence
   * @param fetchs some fetch
   */
   allByOrder(fetchs) {
    let responseArray = []
    let promise = null
    for (let i = 0; i <= fetchs.length; i++) {
      if (!promise) {
        promise = Promise.resolve(() => {fetchs[i].call(this)})
      }else {
        promise = promise.then(data => {
          responseArray.push(data)
          if (i === fetchs.length) {
            return responseArray
          }
          return fetchs[i].call(this)
        })
      }
    }
    return promise.then()
  }

  /**
   * 将函数的数组参数解构 [1,2,3] => 1,2,3
   * @param cb
   * @returns {Function}
   */
  spread(cb) {
    return function (args) {
      return cb.apply(null, args)
    }
  }

  _initPromiseTask(promiseTask, config, request) {
    let interceptors = this.interceptors
    // set request promise
    interceptors.request.forEach(interceptor => {
      promiseTask.add(interceptor.onFulfilled, interceptor.onRejected)
    })
    let fetch;
    //set timeout
    if (config.timeout && config.timeout > 0) {
      fetch = getTimeoutFetch(this.nativeFetch, config.timeout)
      promiseTask.add(fetch)
    } else {
      fetch = this.nativeFetch
      promiseTask.add(fetch)
    }

    //set checkStatus promise
    promiseTask.add(checkStatus)


    //set retry
    if (config.retry && config.retry > 1) {
      promiseTask.add(...getRetryInterceptor(fetch, request, {
        'retryCount': config.retry,
        'retryTimeout': config.retryTimeout
      }))
    }

    //set before transform response interceptors promise
    interceptors.response.noTransform.forEach(interceptor => {
      promiseTask.add(interceptor.onFulfilled, interceptor.onRejected)
    })

    //set transform response promise
    if (config.transformResponse) {
      promiseTask.add(transformResponse.bind(this, config.responseType))
      // set after transform response promise
      interceptors.response.transform.forEach(interceptor => {
        promiseTask.add(interceptor.onFulfilled, interceptor.onRejected)
      })
    }
  }

  _methodsOptionMerge(option = {}, method, body) {
    Object.assign(option, {
      method,
      body
    });
    return option
  }

  _getRequest(init, config) {

    normalizeHeaderName(config.headers, 'Content-Type')

    //handle body
    config.body = config.transformRequest && config.body ? transformRequest(config.body, config.headers) : config.body

    const isRequest = init instanceof Request

    //handle url
    let isNeedMerge = false
    let url = isRequest ? init.url : init
    if (config.baseUrl && !isAbsoluteURL(url)) {
      url = buildAbsoluteURL(config.baseUrl, url)
      isNeedMerge = true
    }
    // like //www.github.com -> https://www.github.com
    if (/^\/\//.test(url)) {
      url = url.replace(/(?=^\/\/)/, 'https:')
      isNeedMerge = true
    }

    if (config.params) {
      url = buildSearchParams(url, config.params)
      isNeedMerge = true
    }

    if (isRequest) {
      if (isNeedMerge) {
        return this._mergeRequest(url, init, config)
      } else {
        return new Request(init, config)
      }
    }
    return new Request(url, config)
  }

  _mergeRequest(url, request, config) {
    let copyRequest = {}
    //copy request props, but body can not get, so request.body will be ignore
    for (let key in request) {
      let val = request[key]
      if (!isFunction(val)) {
        copyRequest[key] = val
      }
    }
    Object.assign(copyRequest, config)
    return new Request(url, copyRequest)
  }
}

module.exports =  zyFetch