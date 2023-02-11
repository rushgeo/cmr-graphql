import { mergeResolvers } from '@graphql-tools/merge'

import collectionDraftResolver from './collectionDraft'
import collectionDraftProposalResolver from './collectionDraftProposal'
import collectionResolver from './collection'
import granuleResolver from './granule'
import gridResolver from './grid'
import serviceResolver from './service'
import subscriptionResolver from './subscription'
import toolResolver from './tool'
import variableResolver from './variable'
import orderOptionResolver from './orderOption'
import dataQualitySummaryResolver from './dataQualitySummary'

const resolvers = [
  collectionDraftResolver,
  collectionDraftProposalResolver,
  collectionResolver,
  dataQualitySummaryResolver,
  granuleResolver,
  gridResolver,
  orderOptionResolver,
  serviceResolver,
  subscriptionResolver,
  toolResolver,
  variableResolver
]

export default mergeResolvers(resolvers)
