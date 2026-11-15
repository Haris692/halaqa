# Teste la visio de production depuis un réseau extérieur (workflow GitHub « Test visio »).
# Génère deux jetons de 10 minutes pour une salle jetable, lance le workflow et attend le résultat.
$ErrorActionPreference = 'Continue'
$root = "$env:USERPROFILE\halaqa-serveur"
$cfg = Get-Content "$root\livekit\livekit.yaml" -Raw
if ($cfg -notmatch '(?m)^keys:\s*\r?\n\s+(\S+):\s*(\S+)') { throw 'clés introuvables dans livekit.yaml' }
$key = $Matches[1]; $secret = $Matches[2]
$wsUrl = (Get-Content "$root\livekit\url.txt" -Raw).Trim()

$js = @'
const crypto = require('crypto')
const [key, secret, room] = process.argv.slice(1)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const token = (identity, canPublish) => {
  const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ iss: key, sub: identity, name: identity, nbf: now - 10, exp: now + 600,
    video: { room, roomJoin: true, canPublish, canSubscribe: true } })
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url')
}
console.log(token('test-publie', true) + ' ' + token('test-regarde', false))
'@
$room = 'test-visio-' + (Get-Random)
$tokens = (node -e $js $key $secret $room) -split ' '
cmd /c "gh workflow run test-visio.yml -f url=$wsUrl -f token_pub=$($tokens[0]) -f token_sub=$($tokens[1])"
Start-Sleep 8
$run = cmd /c "gh run list --workflow test-visio.yml --limit 1 --json databaseId --jq .[0].databaseId"
cmd /c "gh run watch $run --exit-status > nul"
cmd /c "gh run view $run --log" | Select-String 'connecté|publiés|chemin|RÉUSSI|ÉCHEC|Error'
