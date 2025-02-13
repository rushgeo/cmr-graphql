"""Module providing access to environment variables"""
import os
from tempfile import TemporaryDirectory

from varinfo import VarInfoFromNetCDF4
from varinfo.cmr_search import get_granules, get_granule_link, download_granule
from varinfo.umm_var import get_all_umm_var

def main(event, context):
    """Handler that calls the earthdata-varinfo library"""

    # Setup CMR search url from cmrRootUrl
    cmr_url = os.environ['cmrRootUrl'] + '/search/'

    # Pull the concept id and token from the body
    collection_concept_id = event.get('conceptId')

    # Get token
    token = event.get('token')

    # These two arguments are required for varinfo, return an error if they are not provided
    if collection_concept_id is None or token is None:
        return {
            'isBase64Encoded': False,
            'statusCode': 500,
            'body': {
                'error': 'Collection Concept ID and Token must be provided.'
            }
        }

    try:
        # Retrieve a list of 10 granules for the collection
        granules = get_granules(collection_concept_id, cmr_env=cmr_url, token=token)

        # Get the URL for the first granule (NetCDF-4 file):
        granule_link = get_granule_link(granules)

        # Make a temporary directory:
        with TemporaryDirectory() as temp_dir:
            # Download file to lambda runtime environment
            local_granule = download_granule(granule_link, token, out_directory=temp_dir)

            # Parse the granule with VarInfo:
            var_info = VarInfoFromNetCDF4(local_granule)

            # Generate all the UMM-Var records:
            all_variables = get_all_umm_var(var_info)
    except Exception as error:
        return {
            'isBase64Encoded': False,
            'statusCode': 500,
            'body': {
                'error': str(error)
            }
        }

    # Return a successful response
    return {
        'isBase64Encoded': False,
        'statusCode': 200,
        'body': list(all_variables.values())
    }
