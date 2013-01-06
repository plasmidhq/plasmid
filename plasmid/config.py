# configuration

hub = None
port = 8880


def configure(**params):
	for key in params:
		assert key in globals()
		globals()[key] = params[key]
