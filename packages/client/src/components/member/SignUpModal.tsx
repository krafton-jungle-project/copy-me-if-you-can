//todo: 회원가입 페이지 모달 컴포넌트로 변경mi
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Button, Modal, Form, Container } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.css';

const SignUpModal = ({ show, onHide }: { show: boolean; onHide: any }) => {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [idValid, setIdValid] = useState(false);
  const [pwValid, setPwValid] = useState(false);
  const [notAllow, setNotAllow] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (idValid && pwValid) {
      setNotAllow(false);
      return;
    }
    setNotAllow(true);
  }, [idValid, pwValid]);

  const handleId = (e: React.ChangeEvent<HTMLInputElement>) => {
    setId(e.target.value);
    const regex = /^[a-z]+[a-z0-9]{5,19}$/g;
    if (regex.test(e.target.value)) {
      setIdValid(true);
    } else {
      setIdValid(false);
    }
  };
  const handlePw = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPw(e.target.value);
    const regex = /^[a-z]+[a-z0-9]{5,19}$/g;
    if (regex.test(e.target.value)) {
      setPwValid(true);
    } else {
      setPwValid(false);
    }
  };

  const handleName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const onClickConfirmButton = () => {
    console.log('signup');
    axios
      // .post('http://localhost:5001/users', {
      .post('http://15.165.237.195:5001/users', {
        loginid: id,
        name: name,
        password: pw,
      })
      .then((res) => {
        console.log('asd');
        console.log(res.data.data);
        // 토큰을 받아서 저장 (local storage 또는 쿠키?)
        navigate('/login');
        return res;
      })
      .catch((error) => {
        // 회원가입 실패시 알림
        console.log(error);
      });
  };
  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      <Container>
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">회원가입</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>아이디</Form.Label>
              <Form.Control type="text" placeholder="abcd1234" value={id} onChange={handleId} />
              {/* <div className="errorMessageWrap">
                {!idValid && id.length > 0 && <div>올바른 아이디을 입력해주세요.</div>}
              </div> */}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>비밀번호</Form.Label>
              <Form.Control
                type="password"
                placeholder="영문, 숫자 포함"
                value={pw}
                onChange={handlePw}
              />
              {/* <div className="errorMessageWrap">
                {!pwValid && pw.length > 0 && <div>영문, 숫자를 입력해주세요.</div>}
              </div> */}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>닉네임</Form.Label>
              <Form.Control type="text" placeholder="홀란드" value={name} onChange={handleName} />
            </Form.Group>

            <Button
              // block
              variant="info"
              type="button"
              onClick={onClickConfirmButton}
              disabled={notAllow}
              className="CompleteButton"
            >
              가입하기
            </Button>
          </Form>
        </Modal.Body>
      </Container>
    </Modal>
  );
};

export default SignUpModal;