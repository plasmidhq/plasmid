import argparse
import json
import logging
import sys
import time
from os.path import abspath, join, dirname

from zope.interface import implements

from twisted.internet import reactor
from twisted.web.server import Site
from twisted.web.resource import Resource, IResource
from twisted.web.static import File
from twisted.cred.portal import IRealm, Portal
from twisted.cred import error

from plasmid.util import endpoint
from plasmid.storage import Hub, Storage
from plasmid.cred import APIAuthSessionWrapper, PlasmidCredChecker, PlasmidRealm
from plasmid.cred import CredentialBackend
from plasmid.service import Plasmid, ServiceRoot
from plasmid.config import configure
from plasmid import config


logging.basicConfig(level=logging.INFO)

