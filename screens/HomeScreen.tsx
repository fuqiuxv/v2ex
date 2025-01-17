import { Feather } from '@expo/vector-icons'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAtom, useAtomValue } from 'jotai'
import { findIndex, uniqBy } from 'lodash-es'
import { memo, useCallback, useMemo } from 'react'
import {
  FlatList,
  ListRenderItem,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TabBar, TabView } from 'react-native-tab-view'

import Badge from '@/components/Badge'
import IconButton from '@/components/IconButton'
import NavBar, { NAV_BAR_HEIGHT } from '@/components/NavBar'
import { withQuerySuspense } from '@/components/QuerySuspense'
import SearchBar from '@/components/SearchBar'
import { LineSeparator } from '@/components/Separator'
import StyledActivityIndicator from '@/components/StyledActivityIndicator'
import StyledImage from '@/components/StyledImage'
import StyledRefreshControl from '@/components/StyledRefreshControl'
import TopicItem from '@/components/topic/TopicItem'
import { homeTabIndexAtom, homeTabsAtom } from '@/jotai/homeTabsAtom'
import { profileAtom } from '@/jotai/profileAtom'
import { colorSchemeAtom } from '@/jotai/themeAtom'
import { useRecentTopics, useTabTopics } from '@/servicies/topic'
import { Topic } from '@/servicies/types'
import { RootStackParamList } from '@/types'
import { queryClient } from '@/utils/query'
import tw from '@/utils/tw'
import { useRefreshByUser } from '@/utils/useRefreshByUser'

const MemoRecentTopics = memo(withQuerySuspense(RecentTopics))
const MemoTabTopics = memo(withQuerySuspense(TabTopics))

export default withQuerySuspense(HomeScreen)

let isSwiping = false
function isDisabledPress() {
  return isSwiping
}

function HomeScreen() {
  const colorScheme = useAtomValue(colorSchemeAtom)

  const tabs = useAtomValue(homeTabsAtom)

  const layout = useWindowDimensions()

  const [index, setIndex] = useAtom(homeTabIndexAtom)

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  return (
    <View style={tw`flex-1 bg-body-1`}>
      <TopNavBar />
      <TabView
        key={colorScheme}
        navigationState={{ index, routes: tabs }}
        lazy
        lazyPreloadDistance={1}
        onSwipeStart={() => {
          isSwiping = true
        }}
        onSwipeEnd={() => {
          isSwiping = false
        }}
        renderScene={({ route }) => {
          const refetchOnWindowFocus =
            index === findIndex(tabs, { key: route.key })
          return route.key === 'recent' ? (
            <MemoRecentTopics refetchOnWindowFocus={refetchOnWindowFocus} />
          ) : (
            <MemoTabTopics
              refetchOnWindowFocus={refetchOnWindowFocus}
              tab={route.key}
            />
          )
        }}
        onIndexChange={i => {
          if (tabs[i].key === 'recent') {
            queryClient.refetchQueries(useRecentTopics.getKey())
          } else {
            queryClient.refetchQueries(
              useTabTopics.getKey({ tab: tabs[i].key })
            )
          }
          setIndex(i)
        }}
        initialLayout={{
          width: layout.width,
        }}
        renderTabBar={props => (
          <View
            style={tw`flex-row items-center border-b border-tint-border border-solid`}
          >
            <TabBar
              {...props}
              scrollEnabled
              style={tw`bg-body-1 flex-row flex-1 shadow-none`}
              tabStyle={tw`w-[60px] h-[${NAV_BAR_HEIGHT}px]`}
              indicatorStyle={tw`w-[40px] ml-[10px] bg-primary h-1 rounded-full`}
              indicatorContainerStyle={tw`border-b-0`}
              renderTabBarItem={({ route }) => {
                const active = tabs[index].key === route.key

                return (
                  <Pressable
                    key={route.key}
                    style={({ pressed }) =>
                      tw.style(
                        `w-[60px] items-center justify-center h-[${NAV_BAR_HEIGHT}px]`,
                        pressed && tw`bg-tab-press`
                      )
                    }
                    onPress={() => {
                      setIndex(findIndex(tabs, { key: route.key }))
                    }}
                  >
                    <Text
                      style={tw.style(
                        active
                          ? tw`text-tint-primary font-medium`
                          : tw`text-tint-secondary`
                      )}
                    >
                      {route.title}
                    </Text>
                  </Pressable>
                )
              }}
            />

            <TouchableOpacity
              onPress={() => {
                navigation.navigate('SortTabs')
              }}
              style={tw`bg-body-1 h-full flex-row items-center justify-center z-50`}
            >
              <Feather
                name="menu"
                size={17}
                color={tw`text-tint-secondary`.color as string}
                style={tw`-mt-1 pr-4 pl-1`}
              />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  )
}

function RecentTopics({
  refetchOnWindowFocus,
}: {
  refetchOnWindowFocus: boolean
}) {
  const { data, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useRecentTopics({
      suspense: true,
      refetchOnWindowFocus,
    })

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch)

  const renderItem: ListRenderItem<Topic> = useCallback(
    ({ item }) => (
      <TopicItem key={item.id} topic={item} isDisabledPress={isDisabledPress} />
    ),
    []
  )

  const flatedData = useMemo(
    () => uniqBy(data?.pages.map(page => page.list).flat(), 'id'),
    [data?.pages]
  )

  return (
    <FlatList
      data={flatedData}
      refreshControl={
        <StyledRefreshControl
          refreshing={isRefetchingByUser}
          onRefresh={refetchByUser}
        />
      }
      ItemSeparatorComponent={LineSeparator}
      renderItem={renderItem}
      onEndReached={() => {
        if (hasNextPage) {
          fetchNextPage()
        }
      }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        <SafeAreaView edges={['bottom']}>
          {isFetchingNextPage ? (
            <StyledActivityIndicator style={tw`py-4`} />
          ) : null}
        </SafeAreaView>
      }
    />
  )
}

function TabTopics({
  tab,
  refetchOnWindowFocus,
}: {
  tab: string
  refetchOnWindowFocus: boolean
}) {
  const { data, refetch } = useTabTopics({
    variables: { tab },
    suspense: true,
    refetchOnWindowFocus,
  })

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch)

  const renderItem: ListRenderItem<Topic> = useCallback(
    ({ item }) => (
      <TopicItem key={item.id} topic={item} isDisabledPress={isDisabledPress} />
    ),
    []
  )

  return (
    <FlatList
      data={data}
      refreshControl={
        <StyledRefreshControl
          refreshing={isRefetchingByUser}
          onRefresh={refetchByUser}
        />
      }
      ItemSeparatorComponent={LineSeparator}
      ListFooterComponent={<SafeAreaView edges={['bottom']} />}
      renderItem={renderItem}
      ListEmptyComponent={
        <View style={tw`items-center justify-center py-16`}>
          <Text style={tw`text-tint-secondary text-body-6`}>
            目前还没有主题
          </Text>
        </View>
      }
    />
  )
}

function TopNavBar() {
  const profile = useAtomValue(profileAtom)

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  return (
    <NavBar
      left={
        <Pressable
          onPress={() => {
            navigation.dispatch(DrawerActions.openDrawer)
          }}
        >
          {profile ? (
            <Badge content={profile.my_notification}>
              <StyledImage
                style={tw`w-8 h-8 rounded-full`}
                source={{
                  uri: profile.avatar,
                }}
              />
            </Badge>
          ) : (
            <StyledImage
              style={tw`w-8 h-8 rounded-full bg-[rgb(185,202,211)] dark:bg-[rgb(62,65,68)]`}
            />
          )}
        </Pressable>
      }
      right={
        <IconButton
          name="note-edit-outline"
          size={24}
          color={tw`text-tint-secondary`.color as string}
          activeColor={tw`text-tint-primary`.color as string}
          onPress={() => {
            navigation.navigate('WriteTopic', {})
          }}
        />
      }
    >
      <SearchBar
        style={tw`flex-1`}
        editable={false}
        onPress={() => {
          navigation.push('Search')
        }}
      />
    </NavBar>
  )
}
