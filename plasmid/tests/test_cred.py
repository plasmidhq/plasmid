import json

from twisted.trial import unittest

from plasmid import cred

import mock


class TestUnauthorizedResource(unittest.TestCase):

	def test_status(self):
		req = mock.Mock()
		res = cred.UnauthorizedResource()
		resp = res.render(req)

		req.setResponseCode.assertCalledWith(500)
		self.assertFalse(json.loads(resp)['authorized'])