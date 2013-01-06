# configuration

hub = None


def configure(**params):
	for key in params:
		assert key in globals()
		globals()[key] = params[key]