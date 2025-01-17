import { RouteProp, useRoute } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { load } from 'cheerio'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import Html from '@/components/Html'
import LoadingIndicator from '@/components/LoadingIndicator'
import NavBar from '@/components/NavBar'
import {
  FallbackComponent,
  withQuerySuspense,
} from '@/components/QuerySuspense'
import { RootStackParamList } from '@/types'
import { request } from '@/utils/request'
import tw from '@/utils/tw'

export default withQuerySuspense(GItHubMDScreen, {
  Loading: () => {
    const { params } = useRoute<RouteProp<RootStackParamList, 'GItHubMD'>>()

    return (
      <View style={tw`flex-1`}>
        <NavBar title={params.title} />
        <LoadingIndicator />
      </View>
    )
  },
  FallbackComponent: props => {
    const { params } = useRoute<RouteProp<RootStackParamList, 'GItHubMD'>>()
    return (
      <View style={tw`flex-1`}>
        <NavBar title={params.title} />
        <FallbackComponent {...props} />
      </View>
    )
  },
})

function GItHubMDScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'GItHubMD'>>()

  const { data: html } = useQuery(
    [params.url],
    async () => {
      const { data } = await request.get(params.url, { responseType: 'text' })
      return load(data)('#readme').html()
    },
    { suspense: true }
  )

  return (
    <View style={tw`flex-1`}>
      <NavBar title={params.title} />
      <ScrollView>
        <View style={tw`p-4`}>
          <Html source={{ html: html! }} />
        </View>
        <SafeAreaView edges={['bottom']} />
      </ScrollView>
    </View>
  )
}
