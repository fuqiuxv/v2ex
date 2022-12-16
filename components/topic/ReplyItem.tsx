import { useActionSheet } from '@expo/react-native-action-sheet'
import { FontAwesome5, Octicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import dayjs from 'dayjs'
import produce from 'immer'
import { find, findIndex, isBoolean } from 'lodash-es'
import { Fragment, memo } from 'react'
import { Alert, Pressable, Share, Text, View } from 'react-native'
import Toast from 'react-native-toast-message'
import { inferData } from 'react-query-kit'

import { store } from '@/jotai/store'
import { colorSchemeAtom } from '@/jotai/themeAtom'
import {
  useIgnoreReply,
  useThankReply,
  useTopicDetail,
} from '@/servicies/topic'
import { Reply } from '@/servicies/types'
import { RootStackParamList } from '@/types'
import { validateLoginStatus } from '@/utils/authentication'
import { queryClient } from '@/utils/query'
import { baseURL } from '@/utils/request/baseURL'
import { sleep } from '@/utils/sleep'
import tw from '@/utils/tw'

import Html from '../Html'
import IconButton from '../IconButton'
import Space from '../Space'
import StyledButton from '../StyledButton'
import StyledImage from '../StyledImage'

export default memo(ReplyItem)

function ReplyItem({
  reply,
  topicId,
  once,
  hightlight,
  onReply,
  hideViewRelatedReplies,
  index,
  related,
  inModalScreen,
}: {
  topicId: number
  once?: string
  reply: Reply
  hightlight?: boolean
  onReply: (username: string) => void
  hideViewRelatedReplies?: boolean
  index: number
  related?: boolean
  inModalScreen?: boolean
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  return (
    <View
      style={tw.style(
        `px-4 py-3 bg-body-1 border-b border-solid border-tint-border`,
        hightlight && `bg-[#f0f3f5] dark:bg-[#262626]`,
        isBoolean(related) && !related && `opacity-64`
      )}
    >
      <View style={tw`flex-row`}>
        <View style={tw`mr-3`}>
          <Pressable
            onPress={() => {
              if (inModalScreen) navigation.goBack()
              navigation.push('MemberDetail', {
                username: reply.member?.username!,
              })
            }}
          >
            <StyledImage
              style={tw`w-12 h-12 rounded-full`}
              source={{
                uri: reply.member?.avatar,
              }}
            />
          </Pressable>
        </View>

        <View style={tw`flex-1`}>
          <View style={tw`flex-row items-center`}>
            <Space style={tw`mr-auto items-center`}>
              <Text
                key="username"
                style={tw`text-tint-primary text-body-5 font-bold`}
              >
                {reply.member?.username}
              </Text>

              <View style={tw`flex-row items-center`}>
                {reply.mod && (
                  <StyledButton
                    size="mini"
                    type="primary"
                    pressable={false}
                    style={tw.style(reply.op && `rounded-r-none`)}
                  >
                    MOD
                  </StyledButton>
                )}
                {reply.op && (
                  <StyledButton
                    ghost
                    size="mini"
                    pressable={false}
                    type="primary"
                    style={tw.style(reply.mod && `rounded-l-none`)}
                  >
                    OP
                  </StyledButton>
                )}
              </View>
            </Space>

            <Text style={tw`text-body-6 text-tint-secondary`}>
              #{index + 1}
            </Text>
          </View>

          <View style={tw`pt-1`}>
            <Text style={tw`text-tint-secondary text-body-5`}>
              {dayjs(reply.created).fromNow()}
              {reply.via ? ` via ${reply.via}` : ``}
            </Text>
          </View>

          <View style={tw`pt-2`}>
            <Html
              source={{ html: reply.content }}
              inModalScreen={inModalScreen}
            />
          </View>

          <View style={tw`flex-row items-center pt-2`}>
            <Space style={tw`items-center mr-auto`} gap={16}>
              {isBoolean(related) && !related && (
                <Text style={tw`text-body-5 text-tint-secondary`}>
                  可能是无关内容
                </Text>
              )}

              <ThankReply topicId={topicId} once={once} reply={reply} />

              <Pressable
                onPress={() => onReply(reply.member.username)}
                style={tw`flex-row items-center`}
              >
                {({ pressed }) => (
                  <Fragment>
                    <IconButton
                      pressed={pressed}
                      color={tw`text-tint-secondary`.color as string}
                      activeColor="rgb(245,158,11)"
                      size={15}
                      icon={<Octicons name="comment" />}
                    />

                    <Text style={tw`pl-1 text-body-6 text-tint-secondary`}>
                      回复
                    </Text>
                  </Fragment>
                )}
              </Pressable>

              {reply.hasRelatedReplies && !hideViewRelatedReplies && (
                <Pressable
                  onPress={() => {
                    navigation.navigate('RelatedReplies', {
                      replyIndex: index,
                      topicId,
                      onReply: username => {
                        navigation.goBack()
                        sleep(300).then(() => onReply(username))
                      },
                    })
                  }}
                  style={tw`flex-row items-center`}
                >
                  {({ pressed }) => (
                    <Fragment>
                      <IconButton
                        pressed={pressed}
                        color={tw`text-tint-secondary`.color as string}
                        activeColor={tw`text-tint-primary`.color as string}
                        size={15}
                        icon={<FontAwesome5 name="comments" />}
                      />

                      <Text style={tw`pl-1 text-body-6 text-tint-secondary`}>
                        查看评论
                      </Text>
                    </Fragment>
                  )}
                </Pressable>
              )}
            </Space>

            <MoreButton
              once={once}
              index={index}
              reply={reply}
              topicId={topicId}
            />
          </View>
        </View>
      </View>
    </View>
  )
}

function ThankReply({
  reply,
  once,
  topicId,
}: {
  topicId: number
  once?: string
  reply: Reply
}) {
  const { mutateAsync, isLoading } = useThankReply()

  return (
    <View style={tw.style(`flex-row items-center`)}>
      <IconButton
        onPress={async () => {
          validateLoginStatus()

          if (isLoading || reply.thanked) return

          await new Promise((resolve, reject) =>
            Alert.alert(
              `确认花费 10 个铜币向 @${reply.member.username} 的这条回复发送感谢？`,
              ``,
              [
                {
                  text: '取消',
                  onPress: reject,
                  style: 'cancel',
                },
                {
                  text: '确定',
                  onPress: resolve,
                },
              ],
              {
                userInterfaceStyle: store.get(colorSchemeAtom),
              }
            )
          )

          try {
            updateReply(topicId, {
              id: reply.id,
              thanked: !reply.thanked,
              thanks: reply.thanks + 1,
            })

            await mutateAsync({
              id: reply.id,
              once: once!,
            })
          } catch (error) {
            updateReply(topicId, {
              id: reply.id,
              thanked: reply.thanked,
              thanks: reply.thanks,
            })

            Toast.show({
              type: 'error',
              text1: '发送感谢失败',
            })
          }
        }}
        size={16}
        active={reply.thanked}
        name={reply.thanked ? 'heart' : 'heart-outline'}
        color={tw`text-tint-secondary`.color as string}
        activeColor={'rgb(249,24,128)'}
      />

      {!!reply.thanks && (
        <Text
          style={tw.style(
            'text-body-6 pl-0.5',
            reply.thanked ? `text-[rgb(249,24,128)]` : `text-tint-secondary`
          )}
        >
          {reply.thanks}
        </Text>
      )}
    </View>
  )
}

function MoreButton({
  topicId,
  index,
  reply,
  once,
}: {
  topicId: number
  reply: Reply
  index: number
  once?: string
}) {
  const { showActionSheetWithOptions } = useActionSheet()

  const ignoreReplyMutation = useIgnoreReply()

  return (
    <IconButton
      name="dots-horizontal"
      color={tw`text-tint-secondary`.color as string}
      activeColor={tw`text-tint-primary`.color as string}
      size={16}
      onPress={() => {
        const options = ['忽略', '分享', '取消']
        const destructiveButtonIndex = 0
        const cancelButtonIndex = 2

        showActionSheetWithOptions(
          {
            options,
            destructiveButtonIndex,
            cancelButtonIndex,
            userInterfaceStyle: store.get(colorSchemeAtom),
          },
          async selectedIndex => {
            switch (selectedIndex) {
              case 1:
                Share.share({
                  title: reply.content,
                  url: `${baseURL}/t/${topicId}?p=${Math.ceil(
                    index + 1 / 100
                  )}#r_${reply.id}`,
                })
                break

              case destructiveButtonIndex: {
                validateLoginStatus()

                try {
                  await ignoreReplyMutation.mutateAsync({
                    id: reply.id,
                    once: once!,
                  })

                  queryClient.setQueryData<inferData<typeof useTopicDetail>>(
                    useTopicDetail.getKey({ id: topicId }),
                    produce(draft => {
                      if (!draft) return
                      for (const page of draft.pages) {
                        const i = findIndex(page.replies, { id: reply.id })
                        if (i > -1) {
                          page.replies.splice(i, 1)
                          break
                        }
                      }
                    })
                  )

                  Toast.show({
                    type: 'success',
                    text1: '忽略成功',
                  })
                } catch (error) {
                  Toast.show({
                    type: 'error',
                    text1: '忽略失败',
                  })
                }
                break
              }

              case cancelButtonIndex:
              // Canceled
            }
          }
        )
      }}
    />
  )
}

function updateReply(topicId: number, reply: Partial<Reply>) {
  queryClient.setQueryData<inferData<typeof useTopicDetail>>(
    useTopicDetail.getKey({ id: topicId }),
    produce(data => {
      for (const topic of data?.pages || []) {
        const result = find(topic.replies, { id: reply.id })

        if (result) {
          Object.assign(result, reply)
          break
        }
      }
    })
  )
}
