import Service from '../service'

describe('Service concept', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetAllMocks()

    jest.restoreAllMocks()

    process.env = { ...OLD_ENV }

    process.env.cmrRootUrl = 'http://example.com'
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  describe('Service concept', () => {
    describe('retrieve the parent collection', () => {
      describe('if a parent collection is passed into the service', () => {
        test('Ensure that the parentCollectionConceptId can be passed to child queries', () => {
          const service = new Service({}, {}, {}, 'C1234567889')
          service.associationDetails = {}
          const items = { meta: { 'association-details': {} } }
          service.setEssentialUmmValues('S1234', items)
          expect(service.parentCollectionConceptId).toEqual('C1234567889')
        })
      })
    })
  })
})
