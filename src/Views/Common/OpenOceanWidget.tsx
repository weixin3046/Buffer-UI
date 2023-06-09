import { Dialog } from '@mui/material';
import BackIcon from '@SVG/buttons/back';
import { ShareModalStyles } from '@Views/BinaryOptions/Components/shareModal';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { ModalBase } from 'src/Modals/BaseModal';

export const isOceanSwapOpenAtom = atom<false | 'BFR' | 'USDC'>(false);
export const OpenOcean = () => {
  const swapAtom = useAtomValue(isOceanSwapOpenAtom);
  const setSwapAtom = useSetAtom(isOceanSwapOpenAtom);

  return (
    <>
      <ModalBase
        open={swapAtom ? true : false}
        onClose={() => {
          setSwapAtom(false);
        }}
        className=" !px-[0px] !py-[0px] !max-w-[540px] !bg-[#222037] "
      >
        <button
          className="nsm:hidden absolute top-[29px] left-[12px]"
          onClick={() => setSwapAtom(false)}
        >
          <BackIcon />
        </button>
        <iframe
          className=" w-[440px] sm:w-[370px] h-[658px]"
          src={
            'https://widget.openocean.finance/CLASSIC#/ARBITRUM/ETH/' + swapAtom
          }
        ></iframe>
      </ModalBase>
    </>
  );
};
