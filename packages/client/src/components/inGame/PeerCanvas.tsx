import { useEffect, useRef, useState } from 'react';
import * as moveNet from '../../utils/tfjs-movenet';
import styled from 'styled-components';
import { useAtomValue, useSetAtom } from 'jotai';
import { peerAtom } from '../../app/peer';
import { gameAtom, GameStage, GameStatus, peerPoseAtom } from '../../app/game';
import { capturePose } from '../../utils/capture-pose';
import * as movenet from '../../utils/tfjs-movenet';
import { hostAtom } from '../../app/atom';
import { useClientSocket } from '../../module/client-socket';

const Container = styled.div`
  position: absolute;
  box-sizing: border-box;
  right: 0%;
  width: calc(100% * (7 / 8));
  height: 100%;
`;

const Video = styled.video`
  -webkit-transform: scaleX(-1);
  transform: scaleX(-1);
  position: absolute;
  border: 5px solid blue;
  box-sizing: border-box;
  object-fit: cover;
  /* visibility: hidden; */
  width: 100%;
  height: 100%;
`;

const Canvas = styled.canvas<{ isStart: boolean }>`
  position: absolute;
  border: 5px solid blue;
  box-sizing: border-box;
  object-fit: cover;
  visibility: hidden;
  width: 100%;
  height: 100%;
`;

const CapturedPose = styled.canvas`
  -webkit-transform: scaleX(-1);
  transform: scaleX(-1);
  position: absolute;
  border: 5px solid blue;
  box-sizing: border-box;
  object-fit: cover;
  width: 100%;
  height: 100%;
`;

function PeerCanvas({ peerVideoRef }: { peerVideoRef: React.RefObject<HTMLVideoElement> }) {
  const videoRef = peerVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const capturedPoseRef = useRef<HTMLCanvasElement>(null);

  const { socket } = useClientSocket();
  const host = useAtomValue(hostAtom);
  const peer = useAtomValue(peerAtom);
  const game = useAtomValue(gameAtom);
  const setPeerPose = useSetAtom(peerPoseAtom);
  const [isStart, setIsStart] = useState(false);

  useEffect(() => {
    if (videoRef.current === null || canvasRef.current === null || peer.stream === null) return;

    const elements = {
      video: videoRef.current,
      canvas: canvasRef.current,
    };
    moveNet.peerCanvasRender({
      size: { width: 640, height: 480 },
      element: elements,
      peerStream: peer.stream,
    });

    return () => {
      cancelAnimationFrame(moveNet.peerRafId);
    };
  }, [peer.stream]);

  useEffect(() => {
    const getPeerPose = async () => {
      const poses = await movenet.detector.estimatePoses(movenet.peerCamera.video);
      // setGame((prev) => ({ ...prev, capturedPose: poses[0] }));
      setPeerPose(poses[0]);
    };

    if (!game.isOffender && game.stage === GameStage.DEFEND_ANNOUNCEMENT) {
      if (videoRef.current !== null && capturedPoseRef.current !== null) {
        capturedPoseRef.current.style.visibility = 'visible';

        getPeerPose();
        if (host) {
          // 호스트가 수비자일 때 peer의 공격을 캡쳐
          capturePose(videoRef.current, capturedPoseRef.current, 0, socket); //temp
        } else {
          // 호스트가 아닌 플레이어가 수비자일 때 peer의 공격을 캡쳐
          capturePose(videoRef.current, capturedPoseRef.current, 0); //temp
        }

        capturedPoseRef.current.width = videoRef.current.width;
        capturedPoseRef.current.height = videoRef.current.height;
      }
    } else if (
      game.stage !== GameStage.DEFEND_ANNOUNCEMENT &&
      game.stage !== GameStage.DEFEND_COUNTDOWN
    ) {
      if (capturedPoseRef.current !== null) {
        capturedPoseRef.current.style.visibility = 'hidden';
      }
    }

    if (game.isOffender && game.stage === GameStage.OFFEND_ANNOUNCEMENT) {
      if (videoRef.current !== null && capturedPoseRef.current !== null) {
        if (host) {
          // 호스트가 공격자고 수비가 끝났을 때 peer의 수비를 캡쳐
          capturePose(videoRef.current, capturedPoseRef.current, 1, socket);
        } else {
          // 호스트가 아닌 플레이어가 공격자고, peer의 수비를 캡쳐
          capturePose(videoRef.current, capturedPoseRef.current, 1);
        }
        capturedPoseRef.current.style.visibility = 'hidden'; // 임시로 캡처하고 바로 가려버림
      }
    }
    // 사진 잠깐 보여주는 GameStage 요망
  }, [game.stage]);

  useEffect(() => {
    setIsStart(game.status !== GameStatus.WAITING);
  }, [game.status]);

  return (
    <Container>
      <Video ref={videoRef} />
      <Canvas isStart={isStart} ref={canvasRef} />
      <CapturedPose ref={capturedPoseRef} />
    </Container>
  );
}

export default PeerCanvas;
