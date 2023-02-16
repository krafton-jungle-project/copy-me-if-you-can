import type * as poseDetection from '@tensorflow-models/pose-detection';
import * as movenet from './tfjs-movenet';

async function getPose() {
  let pose: poseDetection.Pose;
  const poses = await movenet.detector.estimatePoses(movenet.camera.video);
  if (poses && poses.length > 0) {
    pose = poses[0];
    return pose;
  }
}

export default getPose;