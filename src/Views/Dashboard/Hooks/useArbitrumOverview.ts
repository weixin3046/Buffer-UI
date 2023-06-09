import axios from 'axios';
import { useMemo } from 'react';
import useSWR from 'swr';
import { add, divide } from '@Utils/NumString/stringArithmatics';
import {
  getLinuxTimestampBefore24Hours,
  useDashboardTableData,
} from './useDashboardTableData';
import { useActiveChain } from '@Hooks/useActiveChain';
import { arbitrum, arbitrumGoerli } from 'wagmi/chains';

export type tokenX24hrsStats = {
  amount: string;
  settlementFee: string;
};

export type toalTokenXstats = {
  totalSettlementFees: string;
  totalVolume: string;
  totalTrades: number;
};

type responseType = { totalTraders: [{ uniqueCountCumulative: number }] };

type totalStats = { [key: string]: tokenX24hrsStats[] | toalTokenXstats };

export type arbitrumOverview = {
  [key: string]: tokenX24hrsStats | toalTokenXstats;
} & {
  totalTraders: string;
  openInterest: string | null;
};

function getTokenXquery(tokensArray: string[]) {
  return tokensArray
    .map(
      (token) => `${token}stats:dashboardStat (id : "${token}") {
    totalSettlementFees
    totalTrades
    totalVolume
  }`
    )
    .join(' ');
}
function getTokenX24hrsquery(tokensArray: string[], prevDayEpoch: number) {
  return tokensArray
    .map((token) => {
      const condition =
        token === 'total'
          ? `depositToken: "${token}"`
          : `optionContract_: {pool: "${token}"}, depositToken_not: "total"`;

      return `${token}24stats:volumePerContracts(
          orderBy: timestamp
          orderDirection: desc
          first: 1000
          where: {${condition}, timestamp_gt: ${prevDayEpoch}}
          ) {
            amount
            settlementFee
          }`;
    })
    .join(' ');
}

const getTotalStats = (
  data: toalTokenXstats,
  decimals: number
): toalTokenXstats => {
  return {
    totalSettlementFees: divide(data.totalSettlementFees, decimals) as string,
    totalTrades: data.totalTrades,
    totalVolume: divide(data.totalVolume, decimals) as string,
  };
};
const get24hrsStats = (
  data: tokenX24hrsStats[],
  decimals: number
): tokenX24hrsStats => {
  return data.reduce(
    (acc, curr) => {
      return {
        amount: add(acc.amount, divide(curr.amount, decimals) as string),
        settlementFee: add(
          acc.settlementFee,
          divide(curr.settlementFee, decimals) as string
        ),
      };
    },
    { amount: '0', settlementFee: '0' }
  );
};

export const usePoolNames = () => {
  const { configContracts } = useActiveChain();
  return {
    poolNames: useMemo(
      () => Object.keys(configContracts.tokens),
      [configContracts]
    ),
  };
};
export const usePoolDisplayNames = () => {
  const pools = usePoolNames();
  const { configContracts } = useActiveChain();

  return {
    poolDisplayNameMapping: useMemo(
      () =>
        pools.poolNames.reduce((acc, curr) => {
          acc[curr] = configContracts.tokens[curr].name;
          return acc;
        }, {} as { [key: string]: string }),
      [pools.poolNames, configContracts]
    ),
    poolDisplayKeyMapping: useMemo(
      () =>
        pools.poolNames.reduce((acc, curr) => {
          acc[curr] = curr.replace('_', '-');
          return acc;
        }, {} as { [key: string]: string }),
      [pools.poolNames, configContracts]
    ),
  };
};
export const useArbitrumOverview = () => {
  const { configContracts, activeChain } = useActiveChain();
  const { dashboardData } = useDashboardTableData();
  const prevDayEpoch = getLinuxTimestampBefore24Hours();
  const { poolNames } = usePoolNames();
  const tokensArray = useMemo(() => {
    const array = [...poolNames];
    array.unshift('total');
    return array;
  }, []);

  const statsQuery = useMemo(() => {
    return getTokenXquery(tokensArray);
  }, []);
  const stats24hrsQuery = useMemo(() => {
    return getTokenX24hrsquery(tokensArray, prevDayEpoch);
  }, [prevDayEpoch]);

  const { data } = useSWR('arbitrum-overview', {
    fetcher: async () => {
      if (![arbitrum.id, arbitrumGoerli.id].includes(activeChain.id)) {
        return null;
      }

      const response = await axios.post(configContracts.graph.MAIN, {
        query: `{ 
            ${statsQuery}
            totalTraders:userStats(where: {period: total}) {
              uniqueCountCumulative
            }
           ${stats24hrsQuery}
          }`,
      });
      return response.data?.data as responseType & totalStats;
    },
    refreshInterval: 300,
  });

  const total24hrsStats = useMemo(() => {
    if (!data) return null;
    const returnObj: Partial<{ [key: string]: tokenX24hrsStats }> = {};
    for (let [key, value] of Object.entries(data)) {
      if (value && key.includes('24')) {
        const decimals =
          configContracts.tokens[key.split('24')[0]]?.decimals ?? 6;
        returnObj[key] = get24hrsStats(value as tokenX24hrsStats[], decimals);
      }
    }
    return returnObj;
  }, [data]);

  const totalStats = useMemo(() => {
    if (!data) return null;
    const returnObj: Partial<{ [key: string]: toalTokenXstats }> = {};
    for (let [key, value] of Object.entries(data)) {
      if (value && !key.includes('24') && key.includes('stats')) {
        const decimals =
          configContracts.tokens[key.split('stats')[0]]?.decimals ?? 6;
        returnObj[key] = getTotalStats(value as toalTokenXstats, decimals);
      }
    }
    return returnObj;
  }, [data]);

  const openInterest: { [key: string]: { openInterest: number } } | null =
    useMemo(() => {
      if (!dashboardData) return null;
      const returnObj: { [key: string]: { openInterest: number } } = {};
      dashboardData.forEach((data) => {
        const poolName = `${data.pool}openInterest`;
        if (returnObj[poolName] === undefined) {
          returnObj[poolName] = {
            openInterest: data.openInterest,
          };
        } else {
          returnObj[poolName] = {
            openInterest: returnObj[poolName].openInterest + data.openInterest,
          };
        }
      });
      return returnObj;
    }, [dashboardData]);

  const overView = useMemo(() => {
    if (!data) return null;
    return {
      totalTraders: data.totalTraders[0]?.uniqueCountCumulative || 0,
      ...openInterest,
      ...total24hrsStats,
      ...totalStats,
    };
  }, [data, openInterest, total24hrsStats, totalStats]);

  console.log(overView, data, 'overViewResponse');

  return {
    overView,
  };
};
