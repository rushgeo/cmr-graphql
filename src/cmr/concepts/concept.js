import camelcaseKeys from 'camelcase-keys'
import dasherize from 'dasherize'
import snakeCaseKeys from 'snakecase-keys'

import {
  snakeCase,
  get,
  pick
} from 'lodash'

import { CONCEPT_TYPES } from '../../constants'

import { cmrDelete } from '../../utils/cmrDelete'
import { cmrIngest } from '../../utils/cmrIngest'
import { cmrQuery } from '../../utils/cmrQuery'
import { downcaseKeys } from '../../utils/downcaseKeys'
import { mergeParams } from '../../utils/mergeParams'
import { parseError } from '../../utils/parseError'

export default class Concept {
  /**
   * Instantiates a Concept object
   * @param {String} conceptType The CMR concept type to query against
   * @param {Object} headers HTTP headers provided by the query
   * @param {Object} requestInfo Parsed data pertaining to the Graph query
   * @param {Object} params GraphQL query parameters
   */
  constructor(conceptType, headers = {}, requestInfo = {}, params = {}) {
    // Set properties for data available during instantiation
    this.conceptType = conceptType
    this.headers = headers
    this.requestInfo = requestInfo

    // Defaults the result set to an empty object
    this.items = {}

    // Initialize format specific properties
    this.jsonItemCount = 0
    this.jsonSearchAfterIdentifier = undefined

    this.ummItemCount = 0
    this.ummSearchAfterIdentifier = undefined

    this.params = params

    this.arrayifiableKeys = {
      collectionConceptIds: 'collectionConceptId',
      dataCenters: 'dataCenter',
      providers: 'provider',
      shortNames: 'shortName'
    }
  }

  /**
   * If a plural key is provided it will take the value but 'convert' the key
   * to singular but keep the array of values. This is done so that we can offer
   * two different keys (singular and plural) within the schema.
   * @param {*} searchParams All provided search parameters requested
   */
  arrayifyParams(searchParams) {
    const arrayified = searchParams

    Object.keys(this.arrayifiableKeys).forEach((pluralKey) => {
      const { [pluralKey]: providedValues = [] } = arrayified

      // If a value exists
      if (providedValues.length > 0) {
        arrayified[this.arrayifiableKeys[pluralKey]] = providedValues
      }

      // Delete the plural key because its not supported by CMR
      delete arrayified[pluralKey]
    })

    return arrayified
  }

  /**
   * Set a specific property on an object within the result set of an ingest operation
   * @param {String} key The key to set within the result
   * @param {Any} value They value to assign to the key within the result
   */
  setIngestValue(key, value) {
    this.items[key] = value
  }

  /**
   * Set a specific property on an object within the result set of a search operation
   * @param {String} id Concept ID to set a value for within the result set
   * @param {String} key The key to set within the result
   * @param {Any} value They value to assign to the key within the result
   */
  setItemValue(id, key, value) {
    // Ensure that our object knows about the item by creating it if it doesn't exist
    this.getItem(id)

    // Set the value
    this.items[id][key] = value
  }

  /**
   * Set the total number of records available for a given search to the json endpoint
   * @param {Integer} itemCount The total number of records available for a given search
   */
  setJsonItemCount(itemCount) {
    this.jsonItemCount = parseInt(itemCount, 10)
  }

  /**
   * Set the total number of records available for a given search to the json endpoint
   * @param {Integer} itemCount The total number of records available for a given search
   */
  setUmmItemCount(itemCount) {
    this.ummItemCount = parseInt(itemCount, 10)
  }

  /**
   * Set the search after identifier for a search against against the json endpoint
   * @param {Float} searchAfterIdentifier The search after identifier provided by CMR
   */
  setJsonSearchAfter(searchAfterIdentifier) {
    this.jsonSearchAfterIdentifier = searchAfterIdentifier
  }

  /**
   * Set the search after identifier for a search against against the umm endpoint
   * @param {Float} searchAfterIdentifier The search after identifier provided by CMR
   */
  setUmmSearchAfter(searchAfterIdentifier) {
    this.ummSearchAfterIdentifier = searchAfterIdentifier
  }

  /**
   * Set a value in the result set that a query has not requested but is necessary for other functionality
   * @param {String} id Concept ID to set a value for within the result set
   * @param {Object} item The item returned from the CMR json endpoint
   */
  setEssentialJsonValues(id, item) {
    const { association_details: associationDetails } = item

    const formattedAssociationDetails = camelcaseKeys(associationDetails, { deep: true })

    if (associationDetails) {
      this.setItemValue(id, 'associationDetails', formattedAssociationDetails)
    }
  }

  /**
   * Set a value in the result set that a query has not requested but is necessary for other functionality
   * @param {String} id Concept ID to set a value for within the result set
   * @param {Object} item The item returned from the CMR json endpoint
   */
  setEssentialUmmValues() {}

  /**
   * Get the total number of records available for a given search across all endpoints. Also
   * ensure that the value is the same if a given search spans multiple endpoints
   */
  getItemCount() {
    const { jsonKeys = [], ummKeys = [] } = this.requestInfo

    if (jsonKeys.length) {
      if (ummKeys.length) {
        // If both json and umm keys are being requested ensure that each endpoint
        // returned the same number of results
        if (this.jsonItemCount !== this.ummItemCount) {
          throw new Error(`Inconsistent data prevented GraphQL from correctly parsing results (JSON Hits: ${this.jsonItemCount}, UMM Hits: ${this.ummItemCount})`)
        }

        // Both endpoints returned the same value, return either value here
        return this.ummItemCount
      }

      // Only json keys were requested, return the json item count
      return this.jsonItemCount
    }

    if (ummKeys.length) {
      // Only umm keys were requested, return the umm item count
      return this.ummItemCount
    }

    return 0
  }

  /**
   * Get the CMR concept type of this object
   */
  getConceptType() {
    return this.conceptType
  }

  /**
   * Retrieve a single item from the result set
   * @param {String} id The concept id of an item to lookup in the result set
   */
  getItem(id) {
    // If an item with the provided id does not exist, create one
    if (Object.keys(this.items).indexOf(id) === -1) {
      this.items[id] = {}
    }

    // Fetch the item from the result set
    const { [id]: item } = this.items

    return item
  }

  /**
   * Return the raw result set
   */
  getItems() {
    return this.items
  }

  /**
   * Return the ingest result set formatted for the graphql json response
   */
  getFormattedIngestResponse() {
    // Retrieve the result set regardless of whether or not the query is a list or not
    const items = this.getItems()

    return items
  }

  /**
   * Return the delete result set formatted for the graphql json response
   */
  getFormattedDeleteResponse() {
    // Retrieve the result set regardless of whether or not the query is a list or not
    const items = this.getItems()

    return items
  }

  /**
   * Return the result set formatted for the graphql json response
   */
  getFormattedResponse() {
    // Determine if the query was a list or not, list queries return meta
    // keys using a slightly different format
    const {
      isList
    } = this.requestInfo

    // Retrieve the result set regardless of whether or not the query is a list or not
    const items = this.getItems()

    if (isList) {
      const count = this.getItemCount()
      const cursor = this.encodeCursor()

      return {
        count,
        cursor,
        items: Object.values(items)
      }
    }

    return Object.values(items)
  }

  /**
   * Returns an array of keys representing supported search params for the json endpoint
   */
  getPermittedJsonSearchParams() {
    return [
      'concept_id',
      'offset',
      'page_size',
      'sort_key'
    ]
  }

  /**
   * Returns an array of keys representing supported search params for the umm endpoint
   */
  getPermittedUmmSearchParams() {
    return [
      'concept_id',
      'offset',
      'page_size',
      'sort_key'
    ]
  }

  /**
   * Returns an array of keys that should not be indexed when sent to CMR
   */
  getNonIndexedKeys() {
    return [
      'concept_id',
      'offset',
      'page_size',
      'sort_key'
    ]
  }

  /**
   * Retrieve the request id header from the request
   * @param {Object} headers The provided headers from the query
   * @return {String} Request ID defined in the headers
   */
  getRequestId() {
    const {
      'CMR-Request-Id': requestId
    } = this.headers

    return requestId
  }

  /**
   * Retrieve the client id header from the request
   * @param {Object} headers The provided headers from the query
   * @return {String} Client ID defined in the headers
   */
  getClientId() {
    const {
      'Client-Id': clientId
    } = this.headers

    return clientId
  }

  /**
   * Return the response from the query to CMR
   */
  async getResponse() {
    return this.response
  }

  /**
   * Decodes and returns a base64 hashed version of the json and umm search after identifier
   * @param {String} cursor A base64 hashed object containing search after identifier from CMR
   */
  decodeCursor(cursor) {
    if (cursor) return JSON.parse(Buffer.from(cursor, 'base64').toString())

    return {}
  }

  /**
   * Encode and return a base64 hashed version of the json and umm search after identifier
   */
  encodeCursor() {
    if (this.jsonSearchAfterIdentifier || this.ummSearchAfterIdentifier) {
      return Buffer.from(
        JSON.stringify({
          json: this.jsonSearchAfterIdentifier,
          umm: this.ummSearchAfterIdentifier
        })
      ).toString('base64')
    }

    return null
  }

  /**
   * Ingest the provided object into the CMR
   * @param {Object} data Parameters provided by the query
   * @param {Array} requestedKeys Keys requested by the query
   * @param {Object} providedHeaders Headers requested by the query
   */
  ingest(data, requestedKeys, providedHeaders) {
    // eslint-disable-next-line no-param-reassign
    data = mergeParams(data)

    this.logKeyRequest(requestedKeys, 'ingest')

    // Construct the promise that will ingest data into CMR
    this.response = cmrIngest(
      this.getConceptType(),
      data,
      providedHeaders,
      this.ingestPath
    )
  }

  /**
   * Delete the provided object into the CMR
   * @param {Object} data Parameters provided by the query
   * @param {Array} requestedKeys Keys requested by the query
   * @param {Object} providedHeaders Headers requested by the query
   */
  delete(data, requestedKeys, providedHeaders) {
    // eslint-disable-next-line no-param-reassign
    data = mergeParams(data)

    this.logKeyRequest(requestedKeys, 'ingest')

    // Construct the promise that will delete data from CMR
    this.response = cmrDelete(
      this.getConceptType(),
      data,
      providedHeaders,
      this.ingestPath
    )
  }

  /**
   * Log requested keys for metrics and debugging
   * @param {Array} keys List of keys being requested
   * @param {String} format Format of the request (json, umm, meta)
   */
  logKeyRequest(keys, format) {
    // Prevent logging concept types, their meta keys are logged above
    const filteredKeys = keys.filter((field) => CONCEPT_TYPES.indexOf(field) === -1)

    filteredKeys.forEach((key) => {
      console.log(`Request ${this.getRequestId()} from ${this.getClientId()} to [concept: ${this.getConceptType()}] requested [format: ${format}, key: ${key}]`)
    })
  }

  /**
   * Query the CMR JSON API endpoint to retrieve requested data
   * @param {Object} searchParams Parameters provided by the query
   * @param {Array} requestedKeys Keys requested by the query
   * @param {Object} providedHeaders Headers requested by the query
   */
  fetchJson(searchParams, requestedKeys, providedHeaders) {
    this.logKeyRequest(requestedKeys, 'json')

    // Construct the promise that will request data from the json endpoint
    return cmrQuery({
      conceptType: this.getConceptType(),
      params: pick(snakeCaseKeys(searchParams), this.getPermittedJsonSearchParams()),
      nonIndexedKeys: this.getNonIndexedKeys(),
      headers: providedHeaders
    })
  }

  /**
   * Query the CMR UMM API endpoint to retrieve requested data
   * @param {Object} searchParams Parameters provided by the query
   * @param {Array} requestedKeys Keys requested by the query
   * @param {Object} providedHeaders Headers requested by the query
   */
  fetchUmm(searchParams, requestedKeys, providedHeaders) {
    this.logKeyRequest(requestedKeys, 'umm')

    // Construct the promise that will request data from the umm endpoint
    return cmrQuery({
      conceptType: this.getConceptType(),
      params: pick(snakeCaseKeys(searchParams), this.getPermittedUmmSearchParams()),
      nonIndexedKeys: this.getNonIndexedKeys(),
      headers: providedHeaders,
      options: {
        format: 'umm_json'
      }
    })
  }

  /**
   * Query the CMR API
   * @param {Object} searchParams Parameters provided by the query
   */
  fetch(searchParams) {
    // eslint-disable-next-line no-param-reassign
    searchParams = mergeParams(searchParams)

    // Default an array to hold the promises we need to make depending on the requested fields
    const promises = []

    const {
      jsonKeys,
      metaKeys,
      ummKeys
    } = this.requestInfo

    const {
      cursor
    } = searchParams

    if (cursor) {
      // eslint-disable-next-line no-param-reassign
      delete searchParams.cursor
    }

    const {
      json: jsonSearchAfterIdentifier,
      umm: ummSearchAfterIdentifier
    } = this.decodeCursor(cursor)

    this.logKeyRequest(metaKeys, 'meta')

    if (jsonKeys.length > 0) {
      const jsonHeaders = {
        ...this.headers
      }

      if (jsonSearchAfterIdentifier) {
        jsonHeaders['CMR-Search-After'] = jsonSearchAfterIdentifier
      }

      promises.push(
        this.fetchJson(this.arrayifyParams(searchParams), jsonKeys, jsonHeaders)
      )
    } else {
      // Push a null promise to the array so that the umm promise always exists as
      // the second element of the promise array
      promises.push(
        // eslint-disable-next-line no-promise-executor-return
        new Promise((resolve) => resolve(null))
      )
    }

    // If any requested keys are umm keys, we need to make an additional request to cmr
    if (ummKeys.length > 0) {
      const ummHeaders = {
        ...this.headers
      }

      if (ummSearchAfterIdentifier) {
        ummHeaders['CMR-Search-After'] = ummSearchAfterIdentifier
      }

      // Construct the promise that will request data from the umm endpoint
      promises.push(
        this.fetchUmm(this.arrayifyParams(searchParams), ummKeys, ummHeaders)
      )
    } else {
      promises.push(
        // eslint-disable-next-line no-promise-executor-return
        new Promise((resolve) => resolve(null))
      )
    }

    this.response = Promise.all(promises)
  }

  /**
   * Rename fields, add fields, modify fields, etc
   * @param {Object} item The item returned from the CMR json endpoint
   */
  normalizeJsonItem(item) {
    return item
  }

  /**
   * Rename fields, add fields, modify fields, etc
   * @param {Object} item The item returned from the CMR umm endpoint
   */
  normalizeUmmItem(item) {
    return item
  }

  /**
   * Parse and return the body of an ingest operation
   * @param {Object} ingestResponse HTTP response from the CMR endpoint
   */
  parseIngestBody(ingestResponse) {
    const { data } = ingestResponse

    return data
  }

  /**
   * Parse and return the array of data from the nested response body
   * @param {Object} jsonResponse HTTP response from the CMR endpoint
   */
  parseJsonBody(jsonResponse) {
    const { data } = jsonResponse

    const { feed } = data

    const { entry } = feed

    return entry
  }

  /**
   * Parse and return the array of data from the nested response body
   * @param {Object} ummResponse HTTP response from the CMR endpoint
   */
  parseUmmBody(ummResponse) {
    const { data } = ummResponse

    const { items } = data

    return items
  }

  /**
   * Parses the response from the json endpoint
   * @param {Object} jsonResponse HTTP response from the CMR endpoint
   * @param {Array} jsonKeys Array of the keys requested in the query
   */
  async parseJson(jsonResponse, jsonKeys) {
    const { headers } = jsonResponse
    const {
      'cmr-hits': cmrHits,
      'cmr-search-after': jsonSearchAfterIdentifier
    } = downcaseKeys(headers)

    this.setJsonItemCount(cmrHits)

    this.setJsonSearchAfter(jsonSearchAfterIdentifier)

    const items = this.parseJsonBody(jsonResponse)

    items.forEach((item) => {
      const normalizedItem = this.normalizeJsonItem(item)

      const { concept_id: conceptId } = normalizedItem

      this.setEssentialJsonValues(conceptId, normalizedItem)

      jsonKeys.forEach((jsonKey) => {
        const cmrKey = snakeCase(jsonKey)

        const { [cmrKey]: keyValue } = normalizedItem

        // Snake case the key requested and any children of that key
        this.setItemValue(conceptId, jsonKey, keyValue)
      })
    })
  }

  /**
   * Parses the response from the umm endpoint
   * @param {Object} ummResponse HTTP response from the CMR endpoint
   * @param {Array} ummKeys Array of the keys requested in the query
   */
  async parseUmm(ummResponse, ummKeys) {
    // Pull out the key mappings so we can retrieve the values below
    const { ummKeyMappings } = this.requestInfo

    const { headers } = ummResponse
    const {
      'cmr-hits': cmrHits,
      'cmr-search-after': ummSearchAfterIdentifier
    } = downcaseKeys(headers)

    this.setUmmItemCount(cmrHits)

    this.setUmmSearchAfter(ummSearchAfterIdentifier)

    const items = this.parseUmmBody(ummResponse)

    items.forEach((item) => {
      const normalizedItem = this.normalizeUmmItem(item)

      const { meta } = normalizedItem
      const { 'concept-id': conceptId } = meta

      this.setEssentialUmmValues(conceptId, normalizedItem)

      // Loop through the requested umm keys
      ummKeys.forEach((ummKey) => {
        // Use lodash.get to retrieve a value from the umm response given the
        // path we've defined above
        const keyValue = get(item, ummKeyMappings[ummKey])

        if (keyValue != null) {
          const camelCasedObject = camelcaseKeys({ [ummKey]: keyValue }, { deep: true })

          const { [ummKey]: camelCasedValue } = camelCasedObject

          // Camel case all of the keys of this object (ummKey is already camel cased)
          this.setItemValue(
            conceptId,
            ummKey,
            camelCasedValue
          )
        }
      })
    })
  }

  /**
   * Parses the response from an ingest
   * @param {Object} requestInfo Parsed data pertaining to the ingest operation
   */
  async parseIngest(requestInfo) {
    try {
      const {
        ingestKeys
      } = requestInfo

      const result = await this.getResponse()

      const data = this.parseIngestBody(result)

      ingestKeys.forEach((key) => {
        const cmrKey = dasherize(key)

        const { [cmrKey]: keyValue } = data

        this.setIngestValue(key, keyValue)
      })
    } catch (e) {
      parseError(e, { reThrowError: true })
    }
  }

  /**
   * Parses the response from a delete
   * @param {Object} requestInfo Parsed data pertaining to the delete operation
   */
  async parseDelete(requestInfo) {
    await this.parseIngest(requestInfo)
  }

  /**
   * Parses the response from each endpoint after a request is made
   * @param {Object} requestInfo Parsed data pertaining to the Graph query
   */
  async parse(requestInfo) {
    try {
      const {
        jsonKeys,
        ummKeys
      } = requestInfo

      const response = await this.getResponse()

      const [jsonResponse, ummResponse] = response

      if (jsonResponse) {
        await this.parseJson(jsonResponse, jsonKeys)
      }

      if (ummResponse) {
        await this.parseUmm(ummResponse, ummKeys)
      }
    } catch (e) {
      parseError(e, { reThrowError: true })
    }
  }
}
