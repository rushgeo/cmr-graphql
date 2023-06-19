import axios from 'axios'
import { snakeCase } from 'lodash'

import snakeCaseKeys from 'snakecase-keys'

import { downcaseKeys } from './downcaseKeys'
import { pickIgnoringCase } from './pickIgnoringCase'
import { prepKeysForCmr } from './prepKeysForCmr'

/**
 * Make a request to MMT and return the promise
 * @param {Object} params
 * @param {Object} params.headers Headers to send to MMT
 * @param {Object} param.draftType Parameter draftType sends draft type (Ex: CollectionDraft, ToolDraft)
 * @param {Array} params.nonIndexedKeys Parameter names that should not be indexed before sending to MMT
 * @param {Object} params.params Parameters to send to MMT
 */
export const mmtQuery = ({
  draftType,
  headers,
  nonIndexedKeys = [],
  params
}) => {
  // Default headers
  const defaultHeaders = {}

  // Merge default headers into the provided headers and then pick out only permitted values
  const permittedHeaders = pickIgnoringCase({
    ...defaultHeaders,
    ...headers
  }, [
    'Accept',
    'Authorization',
    'Client-Id',
    'X-Request-Id',
    'User'
  ])

  const cmrParameters = prepKeysForCmr(snakeCaseKeys(params), nonIndexedKeys)

  const { id } = params

  const {
    'client-id': clientId,
    'x-request-id': requestId
  } = downcaseKeys(permittedHeaders)

  const requestConfiguration = {
    data: cmrParameters,
    headers: permittedHeaders,
    method: 'GET',
    url: `${process.env.mmtRootUrl}/api/${snakeCase(draftType)}s/${id}`
  }

  // Interceptors require an instance of axios
  const instance = axios.create()
  const { interceptors } = instance
  const {
    request: requestInterceptor,
    response: responseInterceptor
  } = interceptors

  // Intercept the request to inject timing information
  requestInterceptor.use((config) => {
    // eslint-disable-next-line no-param-reassign
    config.headers['request-startTime'] = process.hrtime()

    return config
  })

  responseInterceptor.use((response) => {
    // Determine total time to complete this request
    const start = response.config.headers['request-startTime']
    const end = process.hrtime(start)
    const milliseconds = Math.round((end[0] * 1000) + (end[1] / 1000000))

    response.headers['request-duration'] = milliseconds

    console.log(`Request ${requestId} from ${clientId} to MMT [Draft Type: ${draftType}] completed external request in [observed: ${milliseconds} ms]`)
    return response
  })

  return instance.request(requestConfiguration)
}
