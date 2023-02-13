import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { WebRTCUser } from "../types";
import PeerVideo from "../components/PeerVideo";
import styled from "styled-components";
import MyVideo from "../components/MyVideo";

const UserLabel = styled.h2`
  color: blue;
`;

//todo 스턴 서버 직접 생성 고려(임시)
const pc_config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// const SOCKET_SERVER_URL = 'http://localhost:8081';
const SOCKET_SERVER_URL = "http://15.165.237.195:8081";

//todo 주소로 직접 접근 시 홈(로그인)/로비 페이지로 redirect
function Room() {
  const navigate = useNavigate();
  const location = useLocation();

  const roomId: string = location.state.roomId;
  const nickName: string = location.state.nickName; //check 전역 변수로 관리하도록 수정 고려 필요
  const socket = io(SOCKET_SERVER_URL); //temp get_room으로 인해 room 정보가 업데이트 될 때마다 소켓이 계속해서 생성된다.

  //todo useRef를 써야할까? 일반 변수로 바꿔서 테스트 및 Ref로 해야한다면 왜 그런지 알아보자
  const socketRef = useRef<Socket>(); // 유저 자신의 socket ref
  const pcsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({}); // 상대 유저의 RTCPeerConnection 저장
  const myVideoRef = useRef<HTMLVideoElement>(null); // 유저 자신의 비디오 ref
  const myStreamRef = useRef<MediaStream>(); // 유저 자신의 스트림 ref
  const [otherUsers, setOtherUsers] = useState<WebRTCUser[]>([]); // 상대 유저들의 정보 저장

  const getMyStream = useCallback(async () => {
    try {
      // 유저 자신의 stream 얻기
      const myStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      myStreamRef.current = myStream;

      if (myVideoRef.current) myVideoRef.current.srcObject = myStream;
      if (!socketRef.current) return;
    } catch (e) {
      console.log(`getUserMedia error: ${e}`);
    }
  }, []);

  // 인자로 받은 유저와 peerConnection을 생성하는 함수
  const makeConnection = useCallback((userId: string, nickName: string) => {
    const peerConnection = new RTCPeerConnection(pc_config);

    peerConnection.addEventListener("icecandidate", (data) => {
      console.log("icecandidate event");
      if (data.candidate && socketRef.current) {
        socketRef.current.emit("ice", {
          candidate: data.candidate,
          candidateSendID: socketRef.current.id,
          candidateReceiveID: userId,
        });
      } else return;
    });

    peerConnection.addEventListener("track", (data) => {
      setOtherUsers((oldUsers) =>
        oldUsers
          .filter((user) => user.id !== userId)
          .concat({
            id: userId,
            nickName,
            stream: data.streams[0],
          })
      );
    });

    if (myStreamRef.current) {
      console.log("my stream added");
      myStreamRef.current.getTracks().forEach((track) => {
        if (!myStreamRef.current) return;
        peerConnection.addTrack(track, myStreamRef.current);
      });
    } else {
      console.log("my stream error");
    }
    return peerConnection;
  }, []);

  useEffect(() => {
    if (!location.state) {
      console.log("no state");
      navigate("/");
    }

    if (!roomId || !nickName || !socket) {
      console.log(`roomId: ${roomId}, nickName: ${nickName}`);
      navigate("/");
    }
    socketRef.current = socket;

    //! 유저 자신 비디오 스트림 얻기
    getMyStream();

    //! socket join
    socketRef.current.emit("join_room", {
      roomId,
      nickName,
    });

    //! 서버에서 다른 유저들의 정보를 받는다
    socketRef.current.on("other_users", (otherUsers: Array<{ id: string; nickName: string }>) => {
      console.log(otherUsers);
      otherUsers.forEach(async (user) => {
        // if (!myStreamRef.current) return;
        const peerConnection = makeConnection(user.id, user.nickName);
        if (!peerConnection || !socketRef.current) return;
        pcsRef.current = { ...pcsRef.current, [user.id]: peerConnection };

        try {
          const offer = await peerConnection.createOffer();
          peerConnection.setLocalDescription(new RTCSessionDescription(offer));
          socketRef.current.emit("offer", {
            sdp: offer,
            offerSendID: socketRef.current.id,
            offerSendNickName: nickName,
            offerReceiveID: user.id,
          });
        } catch (e) {
          console.log(e);
        }
      });
    });

    //! offer를 받은 유저는 answer를 보낸다
    socketRef.current.on(
      "get_offer",
      async (data: {
        sdp: RTCSessionDescription;
        offerSendID: string;
        offerSendNickName: string;
      }) => {
        const { sdp, offerSendID, offerSendNickName } = data;
        if (!myStreamRef.current) return;

        const peerConnection = makeConnection(offerSendID, offerSendNickName);

        if (!(peerConnection && socketRef.current)) return;
        pcsRef.current = { ...pcsRef.current, [offerSendID]: peerConnection };

        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
          console.log("answer set remote description success");
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
          socketRef.current.emit("answer", {
            sdp: answer,
            answerSendID: socketRef.current.id,
            answerReceiveID: offerSendID,
          });
        } catch (e) {
          console.error(e);
        }
      }
    );

    //! answer에 대한 RTCSessionDescription을 얻는다.
    socketRef.current.on(
      "get_answer",
      (data: { sdp: RTCSessionDescription; answerSendID: string }) => {
        const { sdp, answerSendID } = data;
        pcsRef.current[answerSendID].setRemoteDescription(new RTCSessionDescription(sdp));
      }
    );

    socketRef.current.on(
      "get_ice",
      async (data: { candidate: RTCIceCandidateInit; candidateSendID: string }) => {
        try {
          const { candidate, candidateSendID } = data;
          await pcsRef.current[candidateSendID].addIceCandidate(new RTCIceCandidate(candidate));
          console.log("candidate add success");
        } catch (e) {
          console.log(e);
        }
      }
    );

    //! 유저가 나갔을 시
    socketRef.current.on("user_exit", (userId) => {
      if (!pcsRef.current[userId]) return;
      pcsRef.current[userId].close();
      delete pcsRef.current[userId];
      setOtherUsers((oldUsers) => oldUsers.filter((user) => user.id !== userId));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      otherUsers.forEach((user) => {
        if (!pcsRef.current[user.id]) return;
        // closes the current peer connection
        pcsRef.current[user.id].close();
        // pcsRef에서 user 삭제
        delete pcsRef.current[user.id];
      });
      navigate("/");
    };
  }, [getMyStream, makeConnection]);

  return (
    <div>
      <MyVideo />
      <UserLabel>{nickName}</UserLabel>
      {otherUsers.map((user, index) => (
        <PeerVideo key={index} nickName={user.nickName} stream={user.stream} />
      ))}
    </div>
  );
}

export default Room;
