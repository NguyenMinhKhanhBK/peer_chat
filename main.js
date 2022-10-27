let APP_ID = "ad3c65d703a8414fb51d8a566b3f90e5"

let token = null
let uid = String(Math.floor(Math.random() * 10000))

let client
let channel

let localStream
let remoteStream
let peerConnection

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomID = urlParams.get("room")

if (!roomID) {
    window.location = "lobby.html"
}

const stunServers = {
    iceServers: [
        {
            urls: [ 
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
            ],
        }
    ]
}

let constraints = {
    video: {
        width: {min: 640, ideal: 1920, max: 1920},
        height: {min: 480, ideal: 1080, max: 1080},
    },
    audio: false,
}

let init = async () => {
    // agora
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})
    console.log("Login to Agora with UID: ", uid)
    channel = client.createChannel("main")
    await channel.join()

    channel.on("MemberJoined", handleUserJoined)
    channel.on("MemberLeft", handleUserLeft)
    client.on("MessageFromPeer", handleMessageFromPeer)


    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById("video-user-1").srcObject = localStream
}

let createPeerConnection = async (memberID) => {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection(stunServers)
    }
    
    if (!remoteStream) {
        remoteStream = new MediaStream()
        document.getElementById("video-user-2").srcObject = remoteStream
        document.getElementById("video-user-2").style.display = "block"

        document.getElementById("video-user-1").classList.add("small-frame")
    }

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: false})
        document.getElementById("video-user-1").srcObject = localStream
    }

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream)
    })


    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            console.log("New ICE candidate:", event.candidate)
            client.sendMessageToPeer({text: JSON.stringify({"type": "candidate", "msg": event.candidate})}, memberID)
        }
    }
}

let createOffer = async (memberID) => {
    await createPeerConnection(memberID)
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({text: JSON.stringify({"type": "offer", "msg": offer})}, memberID)
}

let createAnswer = async (memberID, offer) => {
    await createPeerConnection(memberID)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    client.sendMessageToPeer({text: JSON.stringify({"type": "answer", "msg": answer})}, memberID)
}

let addIceCandidate = async (candidate) => {
    if (peerConnection.currentRemoteDescription) {
        peerConnection.addIceCandidate(candidate)
    }
}

let acceptAnswer = async (answer) => {
    console.log("acceptAnswer")
    if (!peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(answer)
    }
}

let handleUserJoined = async (memberID) => {
    console.log("A new user joined the channel: ", memberID)
    createOffer(memberID)
}

let handleMessageFromPeer = async (message, memberID) => {
    m = JSON.parse(message.text)
    console.log("Received message from ", memberID, " with content: ", m)

    switch (m.type) {
        case "offer":
            await createAnswer(memberID, m.msg)
            break

        case "answer":
            await acceptAnswer(m.msg)
            break
            
        case "candidate":
            await addIceCandidate(m.msg)
            break

        default:
            console.log("Unsupported msg type: ", m.type)
            break
    }
}

let handleUserLeft = (memberID) => {
    document.getElementById("video-user-2").style.display = "none"
    remoteStream = null
    document.getElementById("video-user-1").classList.remove("small-frame")
}

let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === "video")
    if (videoTrack.enabled) {
        videoTrack.enabled = false
        document.getElementById("btn-camera").style.backgroundColor = "rgb(255,80,80)"
    } else {
        videoTrack.enabled = true
        document.getElementById("btn-camera").style.backgroundColor = "rgb(179, 102, 249, .9)"
    }
}

let toggleMic = async () => {
    let audioTrack= localStream.getTracks().find(track => track.kind === "audio")
    if (audioTrack.enabled) {
        audioTrack.enabled = false
        document.getElementById("btn-mic").style.backgroundColor = "rgb(255,80,80)"
    } else {
        audioTrack.enabled = true
        document.getElementById("btn-mic").style.backgroundColor = "rgb(179, 102, 249, .9)"
    }
}

window.addEventListener("beforeunload", leaveChannel)

document.getElementById("btn-camera").addEventListener("click", toggleCamera)
document.getElementById("btn-mic").addEventListener("click", toggleMic)

init()
