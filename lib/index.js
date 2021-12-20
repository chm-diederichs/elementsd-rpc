var axios = require('axios')
var url = require('url')

function decodeURL(str) {
  var parsedUrl = url.parse(str)
  var hostname = parsedUrl.hostname
  var port = parseInt(parsedUrl.port, 10)
  var protocol = parsedUrl.protocol
  // strip trailing ":"
  protocol = protocol.substring(0, protocol.length - 1)
  var auth = parsedUrl.auth
  var parts = auth.split(':')
  var user = parts[0] ? decodeURIComponent(parts[0]) : null
  var pass = parts[1] ? decodeURIComponent(parts[1]) : null
  var opts = {
    host: hostname,
    port: port,
    protocol: protocol,
    user: user,
    pass: pass,
  }
  return opts
}

function RpcClient(opts) {
  // opts can ba an URL string
  if (typeof opts === 'string') {
    opts = decodeURL(opts)
  }
  opts = opts || {}
  this.host = opts.host || '127.0.0.1'
  this.port = opts.port || 8332
  this.user = opts.user || 'user'
  this.pass = opts.pass || 'pass'
  this.batchedCalls = null

  if(RpcClient.config.log) {
    this.log = RpcClient.config.log
  } else {
    this.log = RpcClient.loggers[RpcClient.config.logger || 'normal']
  }

}

var cl = console.log.bind(console)

var noop = function() {}

RpcClient.loggers = {
  none: {info: noop, warn: noop, err: noop, debug: noop},
  normal: {info: cl, warn: cl, err: cl, debug: noop},
  debug: {info: cl, warn: cl, err: cl, debug: cl}
}

RpcClient.config = {
  logger: 'normal' // none, normal, debug
}

async function rpc(request) {
  var self = this
  request = JSON.stringify(request)

  var auth = {
    username: this.user,
    password: this.pass
  }

  var called = false
  var errorMessage = 'Elements JSON-RPC: '

  try {
    const ret = await axios.post(`http://${this.host}:${this.port}`, request, { auth })
    return ret.data
  } catch (e) {
    if (e?.response?.data?.error?.message) {
      throw new Error(e.response.data.error.message)
    } else throw e
  }
}

RpcClient.prototype.batch = async function (batchCallback) {
  this.batchedCalls = []
  batchCallback()
  const ret = await Promise.all(this.batchedCalls.map(async b => {
    const ret = await rpc.call(this, b)
    return ret.result
  }))
  this.batchedCalls = null
  return ret
}

RpcClient.callspec = {
  abandonTransaction: 'str',
  addMultiSigAddress: '',
  addNode: '',
  backupWallet: '',
  bumpFee: 'str',
  createMultiSig: '',
  createRawTransaction: 'obj obj',
  decodeRawTransaction: '',
  dumpPrivKey: '',
  encryptWallet: '',
  estimateFee: '',
  estimateSmartFee: 'int str',
  estimatePriority: 'int',
  generate: 'int',
  generateToAddress: 'int str',
  getAccount: '',
  getAccountAddress: 'str',
  getAddedNodeInfo: '',
  getAddressMempool: 'obj',
  getAddressesByLabel: '',
  getAddressInfo: '',
  getBalance: 'str int',
  getBestBlockHash: '',
  getBlockDeltas: 'str',
  getBlock: 'str int',
  getBlockchainInfo: '',
  getBlockCount: '',
  getBlockHashes: 'int int obj',
  getBlockHash: 'int',
  getBlockHeader: 'str',
  getBlockNumber: '',
  getBlockTemplate: '',
  getConnectionCount: '',
  getChainTips: '',
  getDifficulty: '',
  getGenerate: '',
  getHashesPerSec: '',
  getInfo: '',
  getMemoryPool: '',
  getMemPoolEntry: 'str',
  getMemPoolInfo: '',
  getMiningInfo: '',
  getNetworkInfo: '',
  getNewAddress: '',
  getNodeAddresses: '',
  getPakInfo: '',
  getPeerInfo: '',
  getRawMemPool: 'bool',
  getRawTransaction: 'str int',
  getReceivedByAccount: 'str int',
  getReceivedByAddress: 'str int',
  getSpentInfo: 'obj',
  getTransaction: '',
  getTxOut: 'str int bool',
  getTxOutSetInfo: '',
  getWalletInfo: '',
  getwalletpakinfo: '',
  getWork: '',
  help: '',
  importAddress: 'str str bool',
  importMulti: 'obj obj',
  importPrivKey: 'str str bool',
  invalidateBlock: 'str',
  issueAsset: 'float float bool',
  keyPoolRefill: '',
  listAccounts: 'int',
  listAddressGroupings: '',
  listIssuances: '',
  listReceivedByAccount: 'int bool',
  listReceivedByAddress: 'int bool',
  listSinceBlock: 'str int',
  listTransactions: 'str int int',
  listUnspent: 'int int',
  listLockUnspent: 'bool',
  lockUnspent: '',
  move: 'str str float int str',
  prioritiseTransaction: 'str float int',
  sendFrom: 'str str float int str str',
  sendMany: 'str obj int str',  //not sure this is will work
  sendRawTransaction: 'str',
  sendToAddress: 'str float str str bool bool int str bool str',
  setAccount: '',
  setGenerate: 'bool int',
  setTxFee: 'float',
  signMessage: '',
  signRawTransaction: '',
  signRawTransactionWithWallet: 'str',
  stop: '',
  submitBlock: '',
  validateAddress: '',
  verifyMessage: '',
  walletLock: '',
  walletPassPhrase: 'string int',
  walletPassphraseChange: '',
}

var slice = function(arr, start, end) {
  return Array.prototype.slice.call(arr, start, end)
}

function generateRPCMethods(constructor, apiCalls, rpc) {

  function createRPCMethod(methodName, argMap) {
    return async function() {
      for (var i = 0; i < arguments.length; i++) {
        if(argMap[i]) {
          arguments[i] = argMap[i](arguments[i])
        }
      }

      if (this.batchedCalls) {
        this.batchedCalls.push({
          jsonrpc: '2.0',
          method: methodName,
          params: slice(arguments),
          id: getRandomId()
        })
      } else {
        return rpc.call(this, {
          jsonrpc: '2.0',
          method: methodName,
          params: slice(arguments),
          id: getRandomId()
        })
      }
    }
  }

  var types = {
    str: function(arg) {
      return arg.toString()
    },
    int: function(arg) {
      return parseFloat(arg)
    },
    float: function(arg) {
      return parseFloat(arg)
    },
    bool: function(arg) {
      return (arg === true || arg == '1' || arg == 'true' || arg.toString().toLowerCase() == 'true')
    },
    obj: function(arg) {
      if(typeof arg === 'string') {
        return JSON.parse(arg)
      }
      return arg
    }
  }

  for(var k in apiCalls) {
    var spec = []
    if (apiCalls[k].length) {
      spec = apiCalls[k].split(' ')
      for (var i = 0; i < spec.length; i++) {
        if(types[spec[i]]) {
          spec[i] = types[spec[i]]
        } else {
          spec[i] = types.str
        }
      }
    }
    var methodName = k.toLowerCase()
    constructor.prototype[k] = createRPCMethod(methodName, spec)
    constructor.prototype[methodName] = constructor.prototype[k]
  }

}

function getRandomId() {
  return parseInt(Math.random() * 100000)
}

generateRPCMethods(RpcClient, RpcClient.callspec, rpc)

module.exports = RpcClient
