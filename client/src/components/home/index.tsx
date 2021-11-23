import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import {
  Avatar,
  Button,
  CircularProgress,
  Container,
  Grid,
  MenuItem,
  Select,
  Snackbar,
  Typography,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import "./index.css";
import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from "../../candy-machine";
import axios from "axios";

const CounterText = styled.span``; // add your styles here
const MintButton = styled(Button)``; // add your styles here
//load from env
const burnAddress = new anchor.web3.PublicKey(
  process.env.REACT_APP_BURN_ADDRESS!
);
const TOKEN_SYMBOL = process.env.REACT_APP_TOKEN_SYMBOL!;
const ENCUBATOR_SYMBOL = process.env.REACT_APP_ENCUBATOR_SYMBOL!;
console.log('symbols', TOKEN_SYMBOL, ENCUBATOR_SYMBOL);
//home component
export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
  devnet: boolean;
}
const Home = (props: HomeProps) => {
  const [balance, setBalance] = useState<number>();
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [itemsRemaining, setItemsRemaining] = useState(0);
  
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });
  const [startDate, setStartDate] = useState(new Date(props.startDate));
  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  //acer
  const [candyMachineValid, setCandyMachineValid] = useState<boolean>(true);
  const [encubators, setEncubators] = useState<Array<any>>([]);
  const [fancyfrenchies, setFancyFrenchies] = useState<Array<any>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [curFrenchy, setCurFrenchy] = useState<number>(-1);
  const [curEncubator, setCurEncubator] = useState<number>(-1);
  const [mutant, setMutant] = useState<any>(null); //metadata of breed nft

  const refreshTokenItems = async () => {
    console.log("refreshTokenItems start");
    if (!wallet) return;

    let url_prefix = "https://api.solscan.io";
    if (props.devnet) url_prefix = "https://api-devnet.solscan.io";
    let url = `${url_prefix}/account/tokens?address=${wallet.publicKey.toString()}`;
    console.log("refreshTokenItems", url);
    let resp = await axios.get(url);

    if (!resp.data.succcess) {
      return;
    }
    let token_list = resp.data.data;
    token_list = token_list.filter(
      (data: { tokenAmount: { uiAmount: number } }) =>
        data.tokenAmount.uiAmount !== 0
    );
    let e_array = [],
      f_array = [];
    //get token information
    for (const item of token_list) {
      const { tokenAddress, tokenAccount } = item;
      const metadata = await getMetaData(tokenAddress);
      if (metadata)
      {
        const symbol = metadata.symbol;
        if (symbol === TOKEN_SYMBOL) {
          f_array.push({
            tokenAddress,
            tokenAccount,
            name: metadata.name,
            image: metadata.image,
          });
        } else {
          e_array.push({
            tokenAddress,
            tokenAccount,
            name: metadata.name,
            image: metadata.image,
          });
        }
      }
    }
    //update state
    console.log("refreshTokenItems", f_array, e_array);
    setFancyFrenchies(f_array);
    setEncubators(e_array);
    setCurEncubator(-1);
    setCurFrenchy(-1);
    setLoading(false);
  };

  //get metadata for one token
  const getMetaData = async (token: anchor.web3.PublicKey, filter: boolean=true) => {
    let url_prefix = "https://api.solscan.io";
    if (props.devnet) url_prefix = "https://api-devnet.solscan.io";

    let token_url = `${url_prefix}/account?address=${token.toString()}`;
    let  resp = await axios.get(token_url);
      if (!resp.data.succcess) return null;
      try {
        const symbol = resp.data.data.metadata.data.symbol;
        if (!filter || symbol === TOKEN_SYMBOL || symbol === ENCUBATOR_SYMBOL) {
          const uri = resp.data.data.metadata.data.uri;
          resp = await axios.get(uri);
          return resp.data;
        }
      }
      catch(error){
        return null;
      }
  }


  const handleFFChange = (event: any) => {
    setCurFrenchy(event.target.value);
    setMutant(null);
  };
  const handleEncChange = (event: any) => {
    setCurEncubator(event.target.value);
    setMutant(null);

  };
  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet || !props.connection) return;

      try {
        const {
          candyMachine,
          goLiveDate,
          itemsAvailable,
          itemsRemaining,
          itemsRedeemed,
        } = await getCandyMachineState(
          wallet as anchor.Wallet,
          props.candyMachineId,
          props.connection
        );

        setItemsAvailable(itemsAvailable);
        setItemsRemaining(itemsRemaining);
        setItemsRedeemed(itemsRedeemed);

        setIsSoldOut(itemsRemaining === 0);
        setStartDate(goLiveDate);
        setCandyMachine(candyMachine);

        setCandyMachineValid(true);
      } catch (error) {
        setCandyMachineValid(false);
      }
    })();
  };

  const onMint = async () => {
    const mint = anchor.web3.Keypair.generate();
    try {
      setIsMinting(true);
      const ffToken = new anchor.web3.PublicKey(
        encubators[curEncubator].tokenAddress
      );
      if (wallet && candyMachine?.program) {
        console.log("before mint one token");
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury,
          ffToken,
          burnAddress,
          mint
        );
        console.log("after mint one token");

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          "singleGossip",
          false
        );

        if (!status?.err) {
          //update mutant image
          const meta = await getMetaData(mint.publicKey, false);
          setMutant(meta);
          setAlertState({
            open: true,
            message: "Congratulations! Breed succeeded!",
            severity: "success",
          });
          //init ecubator
          if (curEncubator!==-1){
            let es = encubators;
            es.splice(curEncubator, 1);
            setEncubators(es);
            setCurEncubator(-1);
          }
        } else {
          setAlertState({
            open: true,
            message: "Breed failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || "Breed failed! Please try again!";
      console.log("error", error);
      if (!error.msg) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to breed. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Breed period hasn't started yet.`;
        }
      }
      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        //set loading state
        setLoading(true);
        //get balance
        //const balance = await props.connection.getBalance(wallet.publicKey);
        //setBalance(balance / LAMPORTS_PER_SOL);
        //init values
        setCurEncubator(-1);
        setCurFrenchy(-1);
        //get token list
        refreshTokenItems();

      }
    })();
  }, [wallet, props.connection, props.devnet]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
    props.devnet
  ]);

  return (
    <main>
      {/* {wallet && (
        <p>Wallet {shortenAddress(wallet.publicKey.toBase58() || "")}</p>
      )}
      {wallet && <p>Total Available: {itemsAvailable}</p>}
      {wallet && <p>Redeemed: {itemsRedeemed}</p>}
      {wallet && <p>Remaining: {itemsRemaining}</p>} */}
      <Container>
        <Grid container spacing={1}>
          <Grid item md={12}>
            <Typography
              variant="h4"
              className={candyMachineValid ? "title" : "title red"}
            >
              {candyMachineValid
                ? "MUTATION EVENT STARTING"
                : "CANDY MACHINE IS NOT VALID"}
            </Typography>
          </Grid>
          <Grid container item md={12} spacing={3}>
            <Grid item md={4} xs={12} className="row">
              <Typography variant="h5" className="subtitle">
                Fancy Frenchies
              </Typography>
              <img
                alt="Fancy Frenchy"
                src={
                  curFrenchy === -1
                    ? "img/ff.png"
                    : fancyfrenchies[curFrenchy].image
                }
                className="image-card"
              />
              <Typography variant="h6" className="subtitle">
                {wallet
                  ? "Select a fancy frenchy"
                  : "Connect wallet and select"}
              </Typography>
              {loading ? (
                <CircularProgress />
              ) : (
                wallet && (
                  <Select
                    label="Age"
                    className="item-select"
                    onChange={handleFFChange}
                    value={curFrenchy}
                  >
                    <MenuItem value={-1}> Not selected</MenuItem>
                    {fancyfrenchies.map((item, index) => (
                      <MenuItem value={index} key={index} className="menu-item">
                        <Avatar src={item.image} />
                        {item.name}
                      </MenuItem>
                    ))}
                  </Select>
                )
              )}
            </Grid>
            <Grid item md={4} xs={12} className="row">
              <Typography variant="h5" className="subtitle">
                Mutant Chamber
              </Typography>
              <div className="mutant-card">
                <img
                  src={mutant?mutant.image :"img/mutant.png"}
                  className="image-card"
                  alt="Mutant Chamber"
                />
                {mutant && <Typography variant="h6" >{mutant.name}</Typography>}
              </div>
              <MintButton
                disabled={
                  isSoldOut ||
                  isMinting ||
                  !isActive ||
                  curEncubator === -1 ||
                  curFrenchy === -1||
                  !candyMachineValid
                }
                onClick={onMint}
                variant="outlined"
                className="mint-button"
              >
                {isSoldOut ? (
                  "Breed Period Finished"
                ) : isActive ? (
                  isMinting ? (
                    <CircularProgress />
                  ) : (
                    "Mint Baby"
                  )
                ) : (
                  <Countdown
                    date={startDate}
                    onMount={({ completed }) => completed && setIsActive(true)}
                    onComplete={() => setIsActive(true)}
                    renderer={renderCounter}
                  />
                )}
              </MintButton>
            </Grid>
            <Grid item md={4} xs={12} className="row">
              <Typography variant="h5" className="subtitle">
                Ecubator
              </Typography>
              <img
                alt="encubator"
                src={
                  curEncubator === -1
                    ? "img/ecubator.png"
                    : encubators[curEncubator].image
                }
                className="image-card"
              />
              <Typography variant="h6" className="subtitle">
                {wallet ? "Select an encubator" : "Connect wallet and select"}
              </Typography>
              {loading ? (
                <CircularProgress />
              ) : (
                wallet && (
                  <Select
                    label="Age"
                    className="item-select"
                    onChange={handleEncChange}
                    value={curEncubator}
                  >
                    <MenuItem value={-1}>Not Selected </MenuItem>
                    {encubators.map((item, index) => (
                      <MenuItem value={index} key={index} className="menu-item">
                        <Avatar src={item.image} />
                        {item.name}
                      </MenuItem>
                    ))}
                  </Select>
                )
              )}
            </Grid>
            <Grid item md={12} className="built-on-solana">
              <Typography variant="h5" className="bottom-title">
                Built with love on
              </Typography>
              <Avatar src="img/solana.jpg" />
              <Typography variant="h5" className="bottom-title">
                Solana
              </Typography>
            </Grid>
          </Grid>
        </Grid>
      </Container>

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </main>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
