import { useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import {
  AppBar,
  Avatar,
  Switch,
  Toolbar,
  Typography,
} from "@material-ui/core";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";
import "./index.css";
import { useAnchorWallet } from "@solana/wallet-adapter-react";

const ConnectButton = styled(WalletDialogButton)``;
const formatAddress = (addr:string) => { 
  const length = addr.length;
  return addr.substr(0,4) + ".." + addr.substr(length-4);

}
const Header = (props: {setDevNet:(devent:boolean) => void, devnet:boolean}) => {
  const wallet = useAnchorWallet();
  
  const handleChange = (event:any) => {
    props.setDevNet(event.target.checked);
  }
  return (
    <AppBar position="fixed" className="appbar">
      <Toolbar>
        <Avatar alt="logo" src="/img/logo.png" className="appbar-logo" />
        <Typography variant="h6" component="div" className="appbar-title">
          Fancyfrenchies Breed
        </Typography>
        <ConnectButton>{wallet && formatAddress(wallet.publicKey.toBase58()) || "Connect"}</ConnectButton>
        <div className="net-select">
          <Switch
            checked={props.devnet}
            onChange={handleChange}
            color="primary"
            disabled={!wallet}
            inputProps={{ 'aria-label': 'primary checkbox' }}
          />
          <Typography> {props.devnet? "DevNet" : "MainNet"}</Typography>
        </div>
      </Toolbar>
    </AppBar>
  );
};
export default Header;
